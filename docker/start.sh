#!/bin/bash
set -e

echo "🚀 Starting Multi-Tenant NestJS Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
until npx prisma db pull --schema=./prisma/schema.prisma > /dev/null 2>&1; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "✅ Database is ready!"

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client (in case it's not already generated)
echo "🔧 Generating Prisma client..."
npx prisma generate

# Seed database if SEED_DATABASE is set to true
if [ "$SEED_DATABASE" = "true" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed
fi

# Start the application
echo "🎯 Starting application..."
exec node dist/main.js