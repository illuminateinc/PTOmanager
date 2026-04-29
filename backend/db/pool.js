const { Pool } = require('pg');

let pool;

async function getPool() {
  if (pool) return pool;

  let password = process.env.DB_PASSWORD;

  if (!password && process.env.DB_SECRET_ARN) {
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const secret = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }));
    password = JSON.parse(secret.SecretString).password;
  }

  pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'pto',
    user:     process.env.DB_USER     || 'pto_admin',
    password: password                || 'localpassword',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return pool;
}

async function query(text, params) {
  const p = await getPool();
  return p.query(text, params);
}

module.exports = { query, getPool };
