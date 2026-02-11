#!/bin/sh
set -e

if [ "${RUN_IMPORT}" = "1" ]; then
  echo "Running CSV import..."
  python import_candidates.py
fi

echo "Starting gunicorn..."
exec gunicorn -c gunicorn.conf.py "app:create_app()"
