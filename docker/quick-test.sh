#!/bin/bash
set -e

echo "🧪 Quick Docker build test..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testing minimal Dockerfile...${NC}"

# Test package patch
echo -e "${YELLOW}Step 1: Testing package patch...${NC}"
node docker/package-patch.js

# Test Docker build
echo -e "${YELLOW}Step 2: Building minimal image...${NC}"
if docker build -f Dockerfile.minimal -t nestjs-test . --no-cache; then
    echo -e "${GREEN}✅ Build successful!${NC}"
    
    # Clean up
    docker rmi nestjs-test
    
    echo -e "${GREEN}🎉 Ready to run: docker-compose up --build${NC}"
else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi