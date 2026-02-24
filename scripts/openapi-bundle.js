#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const srcPath = path.resolve(process.cwd(), 'docs/api/openapi.yml');
const outDir = path.resolve(process.cwd(), 'docs/api/generated');
const outYamlPath = path.join(outDir, 'openapi.yaml');
const outJsonPath = path.join(outDir, 'openapi.json');

if (!fs.existsSync(srcPath)) {
  console.error(`OpenAPI spec not found at ${srcPath}`);
  process.exit(1);
}

const specText = fs.readFileSync(srcPath, 'utf8');
const parsed = yaml.load(specText);

if (!parsed || typeof parsed !== 'object') {
  console.error('OpenAPI spec is not a valid object');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outYamlPath, specText);
fs.writeFileSync(outJsonPath, JSON.stringify(parsed, null, 2) + '\n');

console.log(`Bundled OpenAPI YAML: ${outYamlPath}`);
console.log(`Bundled OpenAPI JSON: ${outJsonPath}`);
