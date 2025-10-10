#!/bin/bash

# Documentation maintenance script
set -e

echo "🔧 Running documentation maintenance..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Update documentation dependencies
echo "📦 Updating documentation dependencies..."
npm update @compodoc/compodoc mermaid-cli markdown-link-check markdownlint-cli

# Generate fresh documentation
echo "📚 Generating fresh documentation..."
npm run docs:full

# Check for outdated links
echo "🔗 Checking for outdated links..."
npm run docs:links

# Generate coverage report
echo "📊 Generating documentation coverage report..."
if command_exists compodoc; then
    compodoc -p tsconfig.json --coverageTest 80 --coverageMinimumPerFile 70
fi

# Clean up old generated files
echo "🧹 Cleaning up old generated files..."
find docs -name "*.svg" -mtime +30 -delete
find docs/compodoc -name "*.html" -mtime +7 -delete 2>/dev/null || true

# Update last maintenance timestamp
echo "$(date)" > docs/.last-maintenance

echo "✅ Documentation maintenance completed!"
echo "📈 Next maintenance recommended in 30 days"