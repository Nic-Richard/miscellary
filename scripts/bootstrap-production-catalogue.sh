#!/usr/bin/env bash
set -euo pipefail

# Production gets the photos that were reviewed and baked from, staged by hash, rather than
# downloading them again from sources that re-encode their files over time.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT_DIR/.env.deploy" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.deploy"
  set +a
fi

: "${AWS_REGION:?Set AWS_REGION in .env.deploy or the environment}"
: "${MEDIA_BUCKET:?Set MEDIA_BUCKET in .env.deploy or the environment}"

export MSYS_NO_PATHCONV=1
cd "$ROOT_DIR"
docker compose exec -T api uv run python manage.py bootstrap_catalogue \
  --export-photos /repo/tmp/seed-photos-staged

DESTINATION="s3://$MEDIA_BUCKET/staging/seed-photos"
aws s3 sync "$ROOT_DIR/tmp/seed-photos-staged" "$DESTINATION" --region "$AWS_REGION" --only-show-errors
bash "$ROOT_DIR/scripts/run-api-task.sh" bootstrap_catalogue --photos "$DESTINATION"
