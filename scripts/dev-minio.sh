#!/usr/bin/env bash
# Run MinIO without Docker. Downloads the binaries into .local/minio on first use.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT_DIR/.local/minio"
BUCKET=miscellary-media
export MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin

mkdir -p "$DIR/data"
for bin in minio mc; do
  if [[ ! -x "$DIR/$bin" ]]; then
    curl -fsSL "https://dl.min.io/${bin/mc/client}/${bin}/release/linux-amd64/${bin}" -o "$DIR/$bin"
    chmod +x "$DIR/$bin"
  fi
done

"$DIR/minio" server "$DIR/data" --address :9000 --console-address :9001 > "$DIR/server.log" 2>&1 &
echo $! > "$DIR/minio.pid"
sleep 2
"$DIR/mc" alias set local http://localhost:9000 minioadmin minioadmin >/dev/null
"$DIR/mc" mb --ignore-existing "local/$BUCKET" >/dev/null
"$DIR/mc" anonymous set download "local/$BUCKET" >/dev/null
# MinIO allows cross-origin requests from any origin by default, which is what
# the browser needs for presigned PUTs. Lock this down with MINIO_API_CORS_ALLOW_ORIGIN
# if you ever expose it beyond localhost.
echo "MinIO ready on http://localhost:9000 (console :9001), bucket $BUCKET"
