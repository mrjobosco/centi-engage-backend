#!/bin/bash

# Documentation validation script
set -e

echo "🔍 Validating documentation..."

# Check if documentation directory exists
if [ ! -d "docs" ]; then
    echo "❌ Documentation directory not found"
    exit 1
fi

# Lint markdown files
echo "📝 Linting markdown files..."
npm run docs:lint

# Check for broken links
echo "🔗 Checking for broken links..."
npm run docs:links

# Validate Mermaid diagrams
echo "📊 Validating Mermaid diagrams..."
if command -v mmdc &> /dev/null; then
    find docs -name "*.mmd" -exec mmdc -i {} -o /tmp/test.svg \; -exec rm /tmp/test.svg \;
    echo "✅ All Mermaid diagrams are valid"
else
    echo "⚠️  Mermaid CLI not found, skipping diagram validation"
fi

# Check for required documentation files
echo "📋 Checking for required documentation files..."
required_files=(
    "docs/README.md"
    "docs/templates/module-readme-template.md"
    "docs/templates/api-reference-template.md"
    "docs/templates/architecture-template.md"
    "docs/templates/troubleshooting-template.md"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Required file missing: $file"
        exit 1
    fi
done

echo "✅ Documentation validation completed successfully!"