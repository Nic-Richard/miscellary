#!/bin/sh
# App Runner has no separate "run a one-off task" step, so migrations run when
# the container starts. Instances roll one at a time, so this is safe for a
# small service; move to a dedicated step if migrations ever get slow.
set -e
python manage.py migrate --noinput
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${WEB_CONCURRENCY:-3}" --access-logfile -
