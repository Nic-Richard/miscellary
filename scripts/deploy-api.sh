#!/usr/bin/env bash
# Build the API image, push it to ECR, and tell App Runner to roll it out.
# Targets come from .env.deploy so nothing account-specific lives in the repo.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/.env.deploy" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.deploy"
  set +a
fi

: "${AWS_REGION:?Set AWS_REGION in .env.deploy}"
: "${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID in .env.deploy}"
: "${ECR_REPOSITORY:?Set ECR_REPOSITORY in .env.deploy}"
: "${APP_RUNNER_SERVICE_ARN:?Set APP_RUNNER_SERVICE_ARN in .env.deploy}"

REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
TAG="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
IMAGE="$REGISTRY/$ECR_REPOSITORY"

cd "$ROOT_DIR"
echo "Building $IMAGE:$TAG"
docker build --platform linux/amd64 --target prod -f docker/api.Dockerfile -t "$IMAGE:$TAG" -t "$IMAGE:latest" .

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker push "$IMAGE:$TAG"
docker push "$IMAGE:latest"

# The service tracks :latest, so a new deployment picks up the image just pushed.
aws apprunner start-deployment --region "$AWS_REGION" --service-arn "$APP_RUNNER_SERVICE_ARN" >/dev/null
echo "Deployment started for $TAG. Watch it in the App Runner console or with:"
echo "  aws apprunner list-operations --region $AWS_REGION --service-arn $APP_RUNNER_SERVICE_ARN"
