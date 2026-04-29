#!/usr/bin/env node
'use strict';

// Invokes the deployed Lambda with a migration payload so it can reach
// the private-subnet RDS instance that isn't accessible locally.
//
// Usage:
//   node db/invoke-migration.js --file schema
//   node db/invoke-migration.js --file seed

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const file = fileIdx !== -1 ? args[fileIdx + 1] : null;

if (!file || !['schema', 'seed'].includes(file)) {
  console.error('Usage: node db/invoke-migration.js --file <schema|seed>');
  process.exit(1);
}

const FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'IlluminatePtoStack-ApiFunction';

(async () => {
  const client = new LambdaClient({ region: 'us-east-1' });

  console.log(`Invoking Lambda "${FUNCTION_NAME}" to run ${file}.sql …`);

  const payload = JSON.stringify({ type: 'migration', file });

  const cmd = new InvokeCommand({
    FunctionName: FUNCTION_NAME,
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(payload),
  });

  const response = await client.send(cmd);

  const result = JSON.parse(Buffer.from(response.Payload).toString());

  if (response.FunctionError) {
    console.error('Lambda returned error:', result);
    process.exit(1);
  }

  console.log('Done:', result);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
