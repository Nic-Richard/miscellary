#!/bin/sh
set -e

if [ -n "${ALLOWED_HOSTS:-}" ]; then
  task_ip="$(python -c 'import socket; print(socket.gethostbyname(socket.gethostname()))')"
  export ALLOWED_HOSTS="${ALLOWED_HOSTS},127.0.0.1,${task_ip}"
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

python manage.py check
python manage.py process_account_cleanup --watch &
cleanup_pid=$!
trap 'kill "$cleanup_pid" "${web_pid:-}" 2>/dev/null || true' EXIT
trap 'exit 0' INT TERM
gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout "${WEB_TIMEOUT:-30}" \
  --access-logfile - &
web_pid=$!
wait "$web_pid"
