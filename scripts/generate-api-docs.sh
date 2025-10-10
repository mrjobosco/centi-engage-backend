#!/bin/bash

# API Documentation Generation Script
# This script generates comprehensive API documentation including OpenAPI specs

set -e

echo "🚀 Generating comprehensive API documentation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create docs directory if it doesn't exist
mkdir -p docs/api/generated

echo -e "${BLUE}📝 Building application...${NC}"
npm run build

echo -e "${BLUE}🔧 Starting application to generate OpenAPI spec...${NC}"
# Start the application in background
npm run start:prod &
APP_PID=$!

# Wait for application to start
echo -e "${YELLOW}⏳ Waiting for application to start...${NC}"
sleep 10

# Check if application is running
if ! curl -s http://localhost:3000/api/docs-json > /dev/null; then
    echo -e "${RED}❌ Application failed to start or Swagger endpoint not available${NC}"
    kill $APP_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✅ Application started successfully${NC}"

# Generate OpenAPI JSON spec
echo -e "${BLUE}📋 Generating OpenAPI specification...${NC}"
curl -s http://localhost:3000/api/docs-json > docs/api/generated/openapi.json

# Generate OpenAPI YAML spec
echo -e "${BLUE}📋 Converting to YAML format...${NC}"
if command -v yq &> /dev/null; then
    yq eval -P docs/api/generated/openapi.json > docs/api/generated/openapi.yaml
    echo -e "${GREEN}✅ OpenAPI YAML generated${NC}"
else
    echo -e "${YELLOW}⚠️  yq not found, skipping YAML generation${NC}"
fi

# Generate Postman collection
echo -e "${BLUE}📮 Generating Postman collection...${NC}"
if command -v openapi2postman &> /dev/null; then
    openapi2postman -s docs/api/generated/openapi.json -o docs/api/generated/postman-collection.json
    echo -e "${GREEN}✅ Postman collection generated${NC}"
else
    echo -e "${YELLOW}⚠️  openapi2postman not found, skipping Postman collection generation${NC}"
fi

# Stop the application
echo -e "${BLUE}🛑 Stopping application...${NC}"
kill $APP_PID 2>/dev/null || true
wait $APP_PID 2>/dev/null || true

# Generate API documentation index
echo -e "${BLUE}📚 Generating API documentation index...${NC}"
cat > docs/api/generated/README.md << 'EOF'
# Generated API Documentation

This directory contains automatically generated API documentation files.

## Files

- `openapi.json` - OpenAPI 3.0 specification in JSON format
- `openapi.yaml` - OpenAPI 3.0 specification in YAML format (if yq is available)
- `postman-collection.json` - Postman collection for API testing (if openapi2postman is available)

## Usage

### OpenAPI Specification
The OpenAPI specification can be used with various tools:
- Import into Postman for API testing
- Generate client SDKs using OpenAPI Generator
- Use with API documentation tools like Redoc or Swagger UI

### Postman Collection
Import the Postman collection to test the API:
1. Open Postman
2. Click "Import"
3. Select `postman-collection.json`
4. Configure environment variables for base URL and authentication

## Interactive Documentation

The interactive API documentation is available when the application is running:
- Swagger UI: http://localhost:3000/api/docs
- OpenAPI JSON: http://localhost:3000/api/docs-json

## Regeneration

To regenerate these files, run:
```bash
npm run docs:api:generate
```

Or manually:
```bash
bash scripts/generate-api-docs.sh
```
EOF

# Generate API statistics
echo -e "${BLUE}📊 Generating API statistics...${NC}"
ENDPOINTS=$(jq '.paths | keys | length' docs/api/generated/openapi.json)
SCHEMAS=$(jq '.components.schemas | keys | length' docs/api/generated/openapi.json)
TAGS=$(jq '.tags | length' docs/api/generated/openapi.json)

cat > docs/api/generated/stats.md << EOF
# API Statistics

Generated on: $(date)

## Overview
- **Total Endpoints**: $ENDPOINTS
- **Data Schemas**: $SCHEMAS
- **API Tags**: $TAGS

## Endpoints by Method
$(jq -r '.paths | to_entries[] | .value | to_entries[] | .key' docs/api/generated/openapi.json | sort | uniq -c | sort -nr)

## Tags
$(jq -r '.tags[] | "- \(.name): \(.description)"' docs/api/generated/openapi.json)

## Security Schemes
$(jq -r '.components.securitySchemes | to_entries[] | "- \(.key): \(.value.type)"' docs/api/generated/openapi.json)
EOF

echo -e "${GREEN}✅ API documentation generation completed!${NC}"
echo -e "${BLUE}📁 Generated files:${NC}"
echo -e "  - docs/api/generated/openapi.json"
echo -e "  - docs/api/generated/openapi.yaml (if yq available)"
echo -e "  - docs/api/generated/postman-collection.json (if openapi2postman available)"
echo -e "  - docs/api/generated/README.md"
echo -e "  - docs/api/generated/stats.md"

echo -e "${YELLOW}💡 Tip: Add the following script to package.json:${NC}"
echo -e '  "docs:api:generate": "bash scripts/generate-api-docs.sh"'

echo -e "${GREEN}🎉 Documentation generation complete!${NC}"