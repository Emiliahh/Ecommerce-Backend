#!/bin/sh
set -e

# Run migrations
echo "Running database migrations..."
npx -y drizzle-kit migrate

# Start the application
echo "Starting the application..."
exec "$@"