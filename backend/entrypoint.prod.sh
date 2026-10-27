#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL database connection..."
if [ -n "$DATABASE_HOST" ] && [ "$DATABASE_HOST" != "localhost" ]; then
    while ! python -c "
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.connect(('${DATABASE_HOST:-db}', int('${DATABASE_PORT:-5432}')))
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
        echo "PostgreSQL (${DATABASE_HOST:-db}:${DATABASE_PORT:-5432}) is unavailable - sleeping..."
        sleep 2
    done
    echo "PostgreSQL is reachable!"
fi

echo "==> Applying database migrations..."
python manage.py migrate --noinput

echo "==> Collecting static assets..."
python manage.py collectstatic --noinput --clear || true

echo "==> Starting production ASGI application server..."
exec "$@"
