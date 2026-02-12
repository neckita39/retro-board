#!/bin/sh
set -e

echo "Running database migrations..."
node migrate.js

echo "Starting server..."
exec node --max-old-space-size=256 server.js
