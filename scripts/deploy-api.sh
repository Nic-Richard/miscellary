#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/.env.deploy" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.deploy"
  set +a
fi

: "${AWS_REGION:?Set AWS_REGION in .env.deploy or the environment}"
: "${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID in .env.deploy or the environment}"
: "${ECR_REPOSITORY:?Set ECR_REPOSITORY in .env.deploy or the environment}"

BRANCH="${GITHUB_REF_NAME:-$(git -C "$ROOT_DIR" branch --show-current)}"
TAG="$(git -C "$ROOT_DIR" rev-parse HEAD)"
REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
IMAGE="$REGISTRY/$ECR_REPOSITORY:$TAG"

if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" && "${ALLOW_DIRTY_DEPLOY:-}" != "1" ]]; then
  echo "Refusing to deploy a dirty worktree. Commit the release or set ALLOW_DIRTY_DEPLOY=1." >&2
  exit 1
fi
if [[ "$BRANCH" != "main" && "${ALLOW_NON_MAIN_DEPLOY:-}" != "1" ]]; then
  echo "Refusing to deploy branch '$BRANCH'. Set ALLOW_NON_MAIN_DEPLOY=1 to override." >&2
  exit 1
fi

CALLER_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$CALLER_ACCOUNT" != "$AWS_ACCOUNT_ID" ]]; then
  echo "AWS CLI is signed into account $CALLER_ACCOUNT, expected $AWS_ACCOUNT_ID." >&2
  exit 1
fi

aws ecr describe-repositories \
  --region "$AWS_REGION" \
  --repository-names "$ECR_REPOSITORY" >/dev/null

if aws ecr describe-images \
  --region "$AWS_REGION" \
  --repository-name "$ECR_REPOSITORY" \
  --image-ids "imageTag=$TAG" >/dev/null 2>&1; then
  echo "Using existing image $IMAGE"
else
  cd "$ROOT_DIR"
  echo "Building $IMAGE"
  docker build --platform linux/amd64 --target prod -f docker/api.Dockerfile -t "$IMAGE" .
  aws ecr get-login-password --region "$AWS_REGION" |
    docker login --username AWS --password-stdin "$REGISTRY"
  docker push "$IMAGE"
fi

if [[ "${PUSH_ONLY:-}" = "1" ]]; then
  echo "Pushed $IMAGE."
  exit 0
fi

: "${ECS_CLUSTER:?Set ECS_CLUSTER in .env.deploy or the environment}"
: "${ECS_SERVICE:?Set ECS_SERVICE in .env.deploy or the environment}"
: "${ECS_TASK_FAMILY:?Set ECS_TASK_FAMILY in .env.deploy or the environment}"

for executable in jq mktemp; do
  if ! command -v "$executable" >/dev/null; then
    echo "$executable is required." >&2
    exit 1
  fi
done

TASK_FILE="$(mktemp)"
trap 'rm -f "$TASK_FILE"' EXIT
aws ecs describe-task-definition \
  --region "$AWS_REGION" \
  --task-definition "$ECS_TASK_FAMILY" \
  --query taskDefinition \
  --output json |
  jq --arg image "$IMAGE" '
    del(
      .taskDefinitionArn,
      .revision,
      .status,
      .requiresAttributes,
      .compatibilities,
      .registeredAt,
      .registeredBy
    )
    | .containerDefinitions |= map(
        if .name == "api" then .image = $image else . end
      )
  ' >"$TASK_FILE"

TASK_DEFINITION="$(aws ecs register-task-definition \
  --region "$AWS_REGION" \
  --cli-input-json "file://$TASK_FILE" \
  --query taskDefinition.taskDefinitionArn \
  --output text)"
NETWORK="$(aws ecs describe-services \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --query 'services[0].networkConfiguration' \
  --output json)"

echo "Running migrations with $TASK_DEFINITION"
MIGRATION_TASK="$(aws ecs run-task \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --launch-type FARGATE \
  --task-definition "$TASK_DEFINITION" \
  --network-configuration "$NETWORK" \
  --overrides '{"containerOverrides":[{"name":"api","command":["python","manage.py","migrate_locked"]}]}' \
  --query 'tasks[0].taskArn' \
  --output text)"
if [[ -z "$MIGRATION_TASK" || "$MIGRATION_TASK" = "None" ]]; then
  echo "ECS did not start the migration task." >&2
  exit 1
fi

aws ecs wait tasks-stopped \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$MIGRATION_TASK"
MIGRATION_EXIT="$(aws ecs describe-tasks \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$MIGRATION_TASK" \
  --query 'tasks[0].containers[?name==`api`].exitCode | [0]' \
  --output text)"
if [[ "$MIGRATION_EXIT" != "0" ]]; then
  echo "Migration task failed with exit code $MIGRATION_EXIT." >&2
  exit 1
fi

aws ecs update-service \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$TASK_DEFINITION" >/dev/null
aws ecs wait services-stable \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE"

: "${SERVICE_HEALTH_URL:?Set SERVICE_HEALTH_URL in .env.deploy or the environment}"
HEALTH_URL="${SERVICE_HEALTH_URL%/}/api/v1/health/"
curl --fail --silent --show-error --retry 6 --retry-delay 5 "$HEALTH_URL" >/dev/null
echo "Deployed $IMAGE and verified $HEALTH_URL"
