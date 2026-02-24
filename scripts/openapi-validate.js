#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const specPath = path.resolve(process.cwd(), 'docs/api/openapi.yml');

function fail(message) {
  console.error(`OpenAPI validation failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(specPath)) {
  fail(`Spec not found at ${specPath}`);
}

let document;
try {
  document = yaml.load(fs.readFileSync(specPath, 'utf8'));
} catch (error) {
  fail(`Invalid YAML: ${error.message}`);
}

if (!document || typeof document !== 'object') {
  fail('Spec must be a YAML object');
}

const requiredTopLevel = ['openapi', 'info', 'paths', 'components'];
for (const key of requiredTopLevel) {
  if (!(key in document)) {
    fail(`Missing required top-level field: ${key}`);
  }
}

if (!document.components.schemas || !document.components.schemas.ErrorResponse) {
  fail('Missing components.schemas.ErrorResponse');
}

if (!document.components.schemas.ApiSuccessBase) {
  fail('Missing components.schemas.ApiSuccessBase');
}

console.log(`OpenAPI spec is valid: ${specPath}`);
