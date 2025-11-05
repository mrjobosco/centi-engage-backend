# Docker Hot Reload Fix Guide

## 🚨 Issue: EBUSY Error with Hot Reload

**Error:** `Error EBUSY: resource busy or locked, rmdir '/app/dist'`

**Root Cause:** The NestJS development server tries to clean/rebuild the `dist` directory, but Docker volume mounting creates file system conflicts.

## ✅ Solutions Implemented

### Solution 1: Hot Reload Optimized Dockerfile (Recommended)

Created `Dockerfile.hotreload` that:
- **Doesn't pre-build** the application
- **Lets NestJS handle building** during development
- **Avoids dist directory conflicts**
- **Optimized for development workflow**

### Solution 2: Volume Configuration Fix

Updated `docker-compose.yml` to:
- **Remove dist volume mount** that causes conflicts
- **Keep only necessary volumes** (source code and node_modules)
- **Let container manage dist directory** internally

## 🚀 Quick Fix Commands

### Option 1: Use Hot Reload Dockerfile (Current Setup)
```bash
# This should now work without EBUSY errors
docker-compose up --build
```

### Option 2: Alternative Development Setup
```bash
# Use the minimal Dockerfile for development
docker build -f Dockerfile.minimal -t nestjs-dev .
docker run -p 3000:3000 -v $(pwd):/app -v /app/node_modules nestjs-dev
```

### Option 3: Manual Fix
```bash
# Stop containers
docker-compose down

# Remove dist directory
rm -rf dist

# Rebuild and start
docker-compose up --build
```

## 🔧 Technical Details

### What Changed in `Dockerfile.hotreload`:
```dockerfile
# OLD (caused issues):
RUN npm run build  # Pre-builds, creates dist conflicts

# NEW (fixed):
CMD ["dumb-init", "npm", "run", "start:dev"]  # Let NestJS build on startup
```

### What Changed in `docker-compose.yml`:
```yaml
# OLD (caused issues):
volumes:
  - .:/app
  - /app/node_modules
  - /app/dist  # This caused the EBUSY error

# NEW (fixed):
volumes:
  - .:/app
  - /app/node_modules  # Only mount source and node_modules
```

## 🐛 If Issues Persist

### Check File Permissions
```bash
# Fix file permissions on host
sudo chown -R $USER:$USER .

# Check Docker volume permissions
docker-compose exec app ls -la /app
```

### Clear Docker Cache
```bash
# Remove all containers and volumes
docker-compose down -v

# Clear Docker cache
docker system prune -a

# Rebuild from scratch
docker-compose up --build
```

### Alternative Development Approach
```bash
# Run only database and Redis in Docker
docker-compose up -d postgres redis mailhog

# Run the app locally
npm install
npm run start:dev
```

### Debug Container Issues
```bash
# Check container logs
docker-compose logs app

# Access container shell
docker-compose exec app sh

# Check file system inside container
docker-compose exec app ls -la /app/dist
```

## 🎯 Verification Steps

### 1. Test Build
```bash
docker build -f Dockerfile.hotreload -t test-build .
echo "✅ Build successful"
```

### 2. Test Container Start
```bash
docker run --rm -d --name test-container -p 3000:3000 test-build
sleep 10
curl http://localhost:3000/api/ && echo "✅ App responding"
docker stop test-container
```

### 3. Test Hot Reload
```bash
# Start with docker-compose
docker-compose up -d

# Make a change to a source file
echo "// Test change" >> src/app.service.ts

# Check if app reloads (watch logs)
docker-compose logs -f app
```

## 📋 Alternative Dockerfiles Available

| Dockerfile | Purpose | Use Case |
|------------|---------|----------|
| `Dockerfile.hotreload` | Development with hot reload | **Recommended for development** |
| `Dockerfile.minimal` | Simple single-stage build | Quick testing |
| `Dockerfile.simple` | Multi-stage with dev/prod | Full production setup |
| `Dockerfile.dev` | Development with nodemon | Alternative development |

## 🔄 Switching Between Dockerfiles

```bash
# Update docker-compose.yml
services:
  app:
    build:
      dockerfile: Dockerfile.hotreload  # Change this line

# Rebuild
docker-compose up --build
```

## 💡 Pro Tips

### For Development
- Use `Dockerfile.hotreload` for best development experience
- Mount only source code and node_modules
- Let NestJS handle building and watching

### For Production
- Use `Dockerfile.simple` with production target
- Pre-build the application
- Use optimized, minimal images

### For Testing
- Use `Dockerfile.minimal` for quick tests
- Separate test database configuration
- Isolated test environment

The hot reload issue should now be completely resolved! 🎉