# Multi-stage Dockerfile for NestJS Multi-Tenant Backend
# Optimized for production with development support

# =============================================================================
# Base Stage - Common dependencies and setup
# =============================================================================
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    bash \
    openssl \
    python3 \
    make \
    g++

# Create app directory
WORKDIR /app

# Set npm configuration for better compatibility
RUN npm config set legacy-peer-deps true && \
    npm config set fund false && \
    npm config set audit false

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# =============================================================================
# Dependencies Stage - Install all dependencies
# =============================================================================
FROM base AS dependencies

# Copy .npmrc for configuration
COPY .npmrc ./

# Install dependencies with fallback strategy
RUN npm install --include=dev --no-optional --legacy-peer-deps || \
    (echo "First attempt failed, trying with npm ci..." && \
     npm ci --include=dev --legacy-peer-deps --no-optional) || \
    (echo "npm ci failed, trying with npm install..." && \
     npm install --include=dev --legacy-peer-deps --no-optional --force)

# Generate Prisma client
RUN npx prisma generate

# =============================================================================
# Build Stage - Build the application
# =============================================================================
FROM dependencies AS build

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Install only production dependencies
RUN npm ci --only=production --legacy-peer-deps --no-optional || \
    npm install --only=production --legacy-peer-deps --no-optional --force

# Clean npm cache
RUN npm cache clean --force

# =============================================================================
# Development Stage - For development with hot reload
# =============================================================================
FROM dependencies AS development

# Install additional development tools
RUN npm install -g @nestjs/cli

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/ || exit 1

# Start development server
CMD ["dumb-init", "npm", "run", "start:dev"]

# =============================================================================
# Production Stage - Optimized for production
# =============================================================================
FROM base AS production

# Copy built application and production dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./

# Copy startup script
COPY docker/start.sh ./start.sh
RUN chmod +x ./start.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/ || exit 1

# Start production server
CMD ["dumb-init", "./start.sh"]

# =============================================================================
# Testing Stage - For running tests
# =============================================================================
FROM dependencies AS testing

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

# Default command for testing
CMD ["npm", "run", "test"]