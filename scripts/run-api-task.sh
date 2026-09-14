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
: "${ECS_CLUSTER:?Set ECS_CLUSTER in .env.deploy or the environment}"
: "${ECS_SERVICE:?Set ECS_SERVICE in .env.deploy or the environment}"

if [[ "$#" -eq 0 ]]; then
  echo "Usage: scripts/run-api-task.sh <management-command> [arguments...]" >&2
  exit 1
fi
if ! command -v jq >/dev/null; then
  echo "jq is required." >&2
  exit 1
fi

TASK_DEFINITION="$(aws ecs describe-services \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --query 'services[0].taskDefinition' \
  --output text)"
NETWORK="$(aws ecs describe-services \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --query 'services[0].networkConfiguration' \
  --output json)"
OVERRIDES="$(jq -cn --args '$ARGS.positional' -- python manage.py "$@" |
  jq -c '{containerOverrides: [{name: "api", command: .}]}')"

TASK="$(aws ecs run-task \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --launch-type FARGATE \
  --task-definition "$TASK_DEFINITION" \
  --network-configuration "$NETWORK" \
  --overrides "$OVERRIDES" \
  --query 'tasks[0].taskArn' \
  --output text)"
if [[ -z "$TASK" || "$TASK" = "None" ]]; then
  echo "ECS did not start the task." >&2
  exit 1
fi

echo "Started $TASK"
aws ecs wait tasks-stopped \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$TASK"
EXIT_CODE="$(aws ecs describe-tasks \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$TASK" \
  --query 'tasks[0].containers[?name==`api`].exitCode | [0]' \
  --output text)"
if [[ "$EXIT_CODE" != "0" ]]; then
  echo "Task failed with exit code $EXIT_CODE. Check the API CloudWatch log group." >&2
  exit 1
fi
echo "Task completed successfully."
