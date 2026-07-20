#!/bin/sh
# Run database migrations (non-fatal — if migrations fail, app still starts)
echo "Running database migrations..."
alembic upgrade head || echo "WARNING: Migrations failed, starting app anyway..."

# Use Cloud Run's dynamic $PORT if set, otherwise fall back to 8000
PORT="${PORT:-8000}"

# Start the application
echo "Starting application on port $PORT..."
exec uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers 1
