#!/usr/bin/env bash
# Start a throwaway local Postgres without Docker (useful on machines where
# Docker is unavailable). Data lives in .local/pg and is gitignored.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$ROOT_DIR/.local/pg"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl || echo /usr/lib/postgresql/16/bin/pg_ctl)")}"
PORT="${PGPORT:-5432}"

case "${1:-start}" in
  start)
    if [[ ! -d "$PGDATA" ]]; then
      mkdir -p "$PGDATA"
      "$PGBIN/initdb" -D "$PGDATA" -U miscellary --auth=trust >/dev/null
      echo "port = $PORT" >> "$PGDATA/postgresql.conf"
    fi
    "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" -w start
    "$PGBIN/psql" -h localhost -p "$PORT" -U miscellary -d postgres -tc \
      "SELECT 1 FROM pg_database WHERE datname='miscellary'" | grep -q 1 || \
      "$PGBIN/createdb" -h localhost -p "$PORT" -U miscellary miscellary
    echo "Postgres ready on localhost:$PORT (user miscellary, password miscellary)"
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$PGDATA" -w stop
    ;;
  *)
    echo "usage: $0 [start|stop]" >&2
    exit 1
    ;;
esac
