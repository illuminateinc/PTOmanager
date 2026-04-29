#!/usr/bin/env node
'use strict';

const cdk = require('aws-cdk-lib');
const { PtoStack } = require('../lib/pto-stack');

const app = new cdk.App();

new PtoStack(app, 'IlluminatePtoStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:  process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Illuminate PTO Manager — full stack (RDS + Cognito + Lambda + API GW + S3 + CloudFront)',
});
