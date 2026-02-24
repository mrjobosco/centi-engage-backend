#!/bin/bash

set -e

echo "Generating OpenAPI artifacts from canonical docs/api/openapi.yml..."

npm run openapi:validate

echo "OpenAPI artifacts generated successfully:"
echo "  - docs/api/generated/openapi.yaml"
echo "  - docs/api/generated/openapi.json"
