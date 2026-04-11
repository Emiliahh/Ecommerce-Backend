#!/bin/sh
set -e

echo "Running database migrations..."

if [ -z "$(ls -A ./drizzle/*.sql 2>/dev/null)" ]; then
  echo "No migration files found, using push..."
  npx drizzle-kit push
else
  echo "Migration files found, running migrate..."
  npx drizzle-kit migrate
fi

echo "Starting the application..."
exec "$@"