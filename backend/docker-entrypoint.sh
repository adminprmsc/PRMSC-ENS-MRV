#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Waiting for PostgreSQL..."
  until node -e "
    const { Client } = require('pg');
    const ssl =
      (process.env.DATABASE_URL || '').includes('sslmode=disable') ||
      /@(localhost|127\\.0\\.0\\.1|postgres|db)(:|\\/)/.test(process.env.DATABASE_URL || '')
        ? false
        : { rejectUnauthorized: false };
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl });
    client
      .connect()
      .then(() => client.end())
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  "; do
    sleep 2
  done

  echo "Running database migrations..."
  node ./node_modules/typeorm/cli.js migration:run \
    -d dist/infrastructure/database/data-source.js
fi

exec "$@"
