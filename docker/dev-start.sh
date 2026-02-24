#!/bin/sh
set -e

echo "[dev-start] Waiting for database..."
until npx prisma db pull --schema=./prisma/schema.prisma >/dev/null 2>&1; do
  echo "[dev-start] Database unavailable, retrying in 2s"
  sleep 2
done

echo "[dev-start] Running Prisma migrations..."
npx prisma migrate deploy

echo "[dev-start] Generating Prisma client..."
npx prisma generate

echo "[dev-start] Starting NestJS dev server..."
exec npm run start:dev
