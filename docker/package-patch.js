#!/usr/bin/env node

// Package.json patcher for Docker builds
// Removes problematic dependencies that cause build issues

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

console.log('Patching package.json for Docker build...');

// Remove problematic dependencies
const problematicDeps = [
  'mermaid-cli', // Causes PhantomJS issues on ARM64
  'phantomjs',   // Not available for ARM64
];

// Remove from devDependencies
problematicDeps.forEach(dep => {
  if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
    console.log(`Removing problematic dependency: ${dep}`);
    delete packageJson.devDependencies[dep];
  }
});

// Remove problematic scripts that depend on removed packages
const problematicScripts = [
  'docs:diagrams', // Depends on mermaid-cli
];

problematicScripts.forEach(script => {
  if (packageJson.scripts && packageJson.scripts[script]) {
    console.log(`Removing problematic script: ${script}`);
    delete packageJson.scripts[script];
  }
});

// Update docs:full script to not depend on diagrams
if (packageJson.scripts && packageJson.scripts['docs:full']) {
  packageJson.scripts['docs:full'] = 'npm run docs:build';
  console.log('Updated docs:full script to remove diagram dependency');
}

// Write the patched package.json
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
console.log('Package.json patched successfully!');