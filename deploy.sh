#!/usr/bin/env bash
# Illuminate PTO — one-shot deploy script
# Run from the repo root: bash deploy.sh
set -euo pipefail

REGION="${AWS_DEFAULT_REGION:-us-east-1}"
echo "==> Region: $REGION"

# ── 1. CDK deploy ─────────────────────────────────────────────────────────────
echo ""
echo "==> [1/6] CDK deploy (VPC + RDS + Cognito + Lambda + API GW + S3 + CloudFront)"
cd infra
npm install --silent
npx cdk bootstrap "aws://$(aws sts get-caller-identity --query Account --output text)/$REGION"
npx cdk deploy --require-approval never --outputs-file cdk-outputs.json
cd ..

# ── 2. Parse outputs ──────────────────────────────────────────────────────────
echo ""
echo "==> [2/6] Parsing CDK outputs → frontend/.env.production"
node infra/scripts/write-env.js

STACK_JSON=$(cat infra/cdk-outputs.json)
BUCKET=$(echo "$STACK_JSON"    | node -e "process.stdin|>JSON.parse|>d=>console.log(d.IlluminatePtoStack.S3BucketName)")
CF_ID=$(echo "$STACK_JSON"     | node -e "process.stdin|>JSON.parse|>d=>console.log(d.IlluminatePtoStack.CloudFrontDistributionId)")
DB_ENDPOINT=$(echo "$STACK_JSON" | node -e "process.stdin|>JSON.parse|>d=>console.log(d.IlluminatePtoStack.DbEndpoint)")
DB_SECRET=$(echo "$STACK_JSON" | node -e "process.stdin|>JSON.parse|>d=>console.log(d.IlluminatePtoStack.DbSecretArn)")
ANTHROPIC_SECRET=$(echo "$STACK_JSON" | node -e "process.stdin|>JSON.parse|>d=>console.log(d.IlluminatePtoStack.AnthropicSecretArn)")
SITE_URL=$(echo "$STACK_JSON"  | node -e "process.stdin|>JSON.parse|>d=>console.log(d.IlluminatePtoStack.SiteUrl)")

# ── 3. Build frontend ─────────────────────────────────────────────────────────
echo ""
echo "==> [3/6] Building frontend"
cd frontend
npm install --silent
npm run build
cd ..

# ── 4. Deploy frontend to S3 ─────────────────────────────────────────────────
echo ""
echo "==> [4/6] Deploying frontend to S3: s3://$BUCKET"
aws s3 sync frontend/dist "s3://$BUCKET" --delete --quiet

echo "==> Invalidating CloudFront cache"
aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*" --output text --query 'Invalidation.Id'

# ── 5. DB schema + seed ───────────────────────────────────────────────────────
echo ""
echo "==> [5/6] Running DB schema + seed (requires psql or bastion)"
DB_CREDS=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET" --query SecretString --output text)
DB_USER=$(echo "$DB_CREDS" | node -e "process.stdin|>JSON.parse|>d=>console.log(d.username)")
DB_PASS=$(echo "$DB_CREDS" | node -e "process.stdin|>JSON.parse|>d=>console.log(d.password)")

echo "  RDS is in a private subnet — run schema migration from within VPC."
echo "  Option A: Use AWS Systems Manager Session Manager to a bastion EC2."
echo "  Option B: Use RDS Data API (if enabled)."
echo "  Option C: Run locally via SSH tunnel."
echo ""
echo "  DB_HOST=$DB_ENDPOINT"
echo "  DB_USER=$DB_USER"
echo "  DB_NAME=pto"
echo ""
echo "  Copy these commands to your bastion:"
echo "    PGPASSWORD='<password>' psql -h $DB_ENDPOINT -U $DB_USER -d pto -f backend/db/schema.sql"
echo "    PGPASSWORD='<password>' psql -h $DB_ENDPOINT -U $DB_USER -d pto -f backend/db/seed.sql"

# ── 6. Anthropic API key ──────────────────────────────────────────────────────
echo ""
echo "==> [6/6] Set your Anthropic API key in Secrets Manager"
echo "  Run: aws secretsmanager put-secret-value \\"
echo "         --secret-id '$ANTHROPIC_SECRET' \\"
echo "         --secret-string '{\"key\":\"sk-ant-YOUR_KEY_HERE\"}'"

echo ""
echo "════════════════════════════════════════════════════════"
echo " DEPLOY COMPLETE"
echo " Live URL: $SITE_URL"
echo "════════════════════════════════════════════════════════"
