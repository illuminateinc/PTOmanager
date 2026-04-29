#!/usr/bin/env node
'use strict';

const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

async function run() {
  const client = new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'pto',
    user:     process.env.DB_USER     || 'pto_admin',
    password: process.env.DB_PASSWORD || 'localpassword',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log(`Connected to ${client.host}:${client.port}/${client.database}`);

  const files = ['schema.sql', 'seed.sql'];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    console.log(`Running ${file}…`);
    await client.query(sql);
    console.log(`✓ ${file} done`);
  }

  await client.end();
  console.log('Migration complete.');
}

run().catch(err => { console.error(err.message); process.exit(1); });
