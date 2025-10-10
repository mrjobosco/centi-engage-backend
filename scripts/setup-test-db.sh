#!/bin/bash

# Setup test database
echo "Setting up test database..."

# Load test environment variables
export $(cat .env.test | grep -v '^#' | xargs)

# Create test database if it doesn't exist
echo "Creating test database if it doesn't exist..."
createdb -U postgres -h localhost multitenant_db_test 2>/dev/null || echo "Database may already exist"

# Run migrations
echo "Running migrations on test database..."
npx prisma migrate deploy

echo "Test database setup complete!"
