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
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout "${WEB_TIMEOUT:-30}" \
  --access-logfile -
