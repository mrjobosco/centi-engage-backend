# Docker Build Troubleshooting Guide

## 🚨 Common Docker Build Issues & Solutions

### Issue 1: Node.js Version Mismatch
**Error:** `EBADENGINE Unsupported engine { package: '@nestjs/core@11.1.6', required: { node: '>= 20' }, current: { node: 'v18.20.8' } }`

**Solution:** ✅ **FIXED** - Updated Dockerfile to use Node.js 20
```dockerfile
FROM node:20-alpine AS base  # Changed from node:18-alpine
```

### Issue 2: PhantomJS Architecture Issues
**Error:** `Unexpected platform or architecture: linux/arm64` and `PhantomJS not found on PATH`

**Root Cause:** The `mermaid-cli@0.2.4` package depends on PhantomJS which doesn't support ARM64 (Apple Silicon).

**Solution:** ✅ **FIXED** - Created package patcher to remove problematic dependencies
- Created `docker/package-patch.js` to remove `mermaid-cli` and `phantomjs`
- Updated `Dockerfile.fixed` to use the patcher
- Modified related scripts to not depend on removed packages

### Issue 3: Peer Dependency Conflicts
**Error:** `npm warn ERESOLVE overriding peer dependency`

**Solution:** ✅ **FIXED** - Added npm configuration flags
```dockerfile
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false
```

### Issue 4: NPM Config Deprecated Options
**Error:** `npm error The 'optional' option is deprecated, and can not be set in this way`

**Solution:** ✅ **FIXED** - Use environment variables and --omit=optional flag
- Removed `npm config set optional false`
- Use `--omit=optional` in npm install commands
- Use environment variables instead of npm config commands

## 🔧 Fixed Files

### 1. **Dockerfile.minimal** (New - Recommended)
- Uses Node.js 20
- Includes build tools (python3, make, g++)
- Patches package.json before installation
- Simple, reliable npm installation
- Environment variables for npm config

### 2. **Dockerfile.simple** (Alternative)
- Multi-stage build with development/production targets
- More complex but optimized for different environments

### 3. **Dockerfile.fixed** (Original fix)
- Most comprehensive but had npm config issues

### 2. **docker/package-patch.js** (New)
- Removes problematic dependencies (`mermaid-cli`, `phantomjs`)
- Updates scripts that depend on removed packages
- Maintains package.json integrity

### 3. **Updated docker-compose.yml**
- Now uses `Dockerfile.fixed` instead of `Dockerfile`
- All environment variables properly configured

### 4. **.npmrc** (New)
- Configures npm for better Docker compatibility
- Disables problematic features

## 🚀 Quick Fix Commands

### Option 1: Use the Minimal Setup (Recommended)
```bash
# Quick test
./docker/quick-test.sh

# If test passes, start development
docker-compose up --build
```

### Option 2: Manual Build
```bash
# Build with minimal Dockerfile
docker build -f Dockerfile.minimal -t nestjs-app .

# Run manually
docker run -p 3000:3000 nestjs-app
```

### Option 3: Skip Problematic Dependencies
```bash
# Patch package.json first
node docker/package-patch.js

# Then build normally
docker-compose up --build
```

## 🔍 Verification Steps

### 1. Test Package Patch
```bash
node docker/package-patch.js
echo "✅ Package patched successfully"
```

### 2. Test Docker Build
```bash
docker build -f Dockerfile.fixed --target development -t test-build .
echo "✅ Build completed successfully"
```

### 3. Test Container Run
```bash
docker run --rm -d --name test-run test-build
sleep 5
docker ps | grep test-run && echo "✅ Container running"
docker stop test-run
```

## 🐛 If Issues Persist

### Check System Architecture
```bash
# Check if you're on ARM64 (Apple Silicon)
uname -m
# If output is "arm64", you're on Apple Silicon

# Check Docker platform
docker version --format '{{.Server.Arch}}'
```

### Force x86_64 Build (Apple Silicon)
```bash
# Build for x86_64 platform
docker build --platform linux/amd64 -f Dockerfile.fixed --target development -t nestjs-app .
```

### Clean Docker Cache
```bash
# Remove all Docker cache
docker system prune -a --volumes

# Remove specific images
docker rmi $(docker images -q nestjs-multitenant)
```

### Alternative: Use Docker Compose Override
Create `docker-compose.override.yml`:
```yaml
version: '3.8'
services:
  app:
    build:
      dockerfile: Dockerfile.fixed
      args:
        - BUILDPLATFORM=linux/amd64
    platform: linux/amd64
```

## 📋 Dependency Analysis

### Removed Dependencies
- `mermaid-cli@0.2.4` - Causes PhantomJS issues
- `phantomjs` - Not available for ARM64

### Updated Scripts
- `docs:diagrams` - Removed (depends on mermaid-cli)
- `docs:full` - Updated to not depend on diagrams

### Alternative Solutions
If you need diagram generation:
```bash
# Install mermaid-cli globally (outside Docker)
npm install -g @mermaid-js/mermaid-cli

# Or use online tools
# https://mermaid.live/
```

## 🎯 Production Considerations

### For Production Deployment
```bash
# Use the production-optimized build
docker build -f Dockerfile.fixed --target production -t nestjs-app:prod .

# Or use docker-compose
docker-compose -f docker-compose.prod.yml up --build
```

### Environment Variables
Ensure your `.env.production` file has all required variables:
```bash
cp .env.production.example .env.production
# Edit .env.production with real values
```

## 📞 Support

If you continue to experience issues:

1. **Check the logs:**
   ```bash
   docker-compose logs app
   ```

2. **Run the test build:**
   ```bash
   ./docker/test-build.sh
   ```

3. **Try the alternative Dockerfile:**
   ```bash
   # Use original Dockerfile with manual fixes
   docker build --target development -t nestjs-app .
   ```

4. **Platform-specific build:**
   ```bash
   # For Apple Silicon
   docker build --platform linux/amd64 -f Dockerfile.fixed -t nestjs-app .
   ```

The fixed setup should resolve all the dependency and architecture issues you encountered!