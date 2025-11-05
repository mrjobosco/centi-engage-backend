#!/bin/bash
set -e

echo "🧪 Testing Docker build with dependency fixes..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Testing package.json patch...${NC}"
node docker/package-patch.js

echo -e "${YELLOW}Step 2: Building development image...${NC}"
if docker build -f Dockerfile.simple --target development -t nestjs-multitenant:dev-test . --no-cache; then
    echo -e "${GREEN}✅ Development build successful!${NC}"
else
    echo -e "${RED}❌ Development build failed!${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 3: Testing container startup...${NC}"
if docker run --rm -d --name test-container nestjs-multitenant:dev-test; then
    echo -e "${GREEN}✅ Container started successfully!${NC}"
    
    # Wait a moment for startup
    sleep 5
    
    # Check if container is still running
    if docker ps | grep -q test-container; then
        echo -e "${GREEN}✅ Container is running properly!${NC}"
        docker stop test-container
    else
        echo -e "${RED}❌ Container stopped unexpectedly!${NC}"
        docker logs test-container
        exit 1
    fi
else
    echo -e "${RED}❌ Container failed to start!${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 All tests passed! Docker build is working correctly.${NC}"

# Clean up test image
docker rmi nestjs-multitenant:dev-test

echo -e "${YELLOW}💡 You can now run: ./docker/setup.sh dev${NC}"