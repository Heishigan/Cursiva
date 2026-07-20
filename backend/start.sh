#!/bin/sh
# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Start the application
echo "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
