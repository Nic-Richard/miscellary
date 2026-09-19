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
: "${MEDIA_BUCKET:?Set MEDIA_BUCKET in .env.deploy or the environment}"

RENDER_DIR="${1:-$ROOT_DIR/tmp/card-renders}"
MANIFEST="$RENDER_DIR/manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing render manifest: $MANIFEST" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PREFIX="staging/card-renders/$STAMP"
DESTINATION="s3://$MEDIA_BUCKET/$PREFIX"

aws s3 cp "$RENDER_DIR" "$DESTINATION" --recursive --region "$AWS_REGION" --only-show-errors
bash "$ROOT_DIR/scripts/run-api-task.sh" import_card_renders "$DESTINATION/manifest.json"

echo "Imported production renders from $DESTINATION"
echo "The private staging files can be removed after verify_renders succeeds."
