#!/bin/sh
set -e
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

python manage.py check
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout "${WEB_TIMEOUT:-30}" \
  --access-logfile -
