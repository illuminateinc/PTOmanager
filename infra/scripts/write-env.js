#!/usr/bin/env node
// Reads cdk-outputs.json and writes frontend/.env.production
'use strict';

const fs   = require('fs');
const path = require('path');

const outputs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cdk-outputs.json'), 'utf8'));
const stack   = outputs['IlluminatePtoStack'];

if (!stack) {
  console.error('ERROR: IlluminatePtoStack not found in cdk-outputs.json');
  process.exit(1);
}

const envContent = [
  `VITE_COGNITO_USER_POOL_ID=${stack.UserPoolId}`,
  `VITE_COGNITO_CLIENT_ID=${stack.UserPoolClientId}`,
  `VITE_API_URL=/api`,
  '',
].join('\n');

const envPath = path.join(__dirname, '..', '..', 'frontend', '.env.production');
fs.writeFileSync(envPath, envContent);

console.log('✓ Wrote frontend/.env.production');
console.log(`  User Pool ID:  ${stack.UserPoolId}`);
console.log(`  Client ID:     ${stack.UserPoolClientId}`);
console.log(`  Site URL:      ${stack.SiteUrl}`);
console.log(`  API URL:       ${stack.ApiUrl}`);
console.log('');
console.log('Next: run the deploy script  →  bash deploy.sh');
