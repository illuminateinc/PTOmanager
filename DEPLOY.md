# Illuminate PTO Manager — Deployment Guide

## What gets deployed

| Layer | Service | Cost (est.) |
|---|---|---|
| Frontend | S3 + CloudFront | ~$1–5/mo |
| API | Lambda + API Gateway | ~$0–2/mo (pay-per-request) |
| Database | RDS PostgreSQL db.t3.micro | ~$15/mo |
| Auth | Cognito | Free up to 50K MAU |
| Secrets | Secrets Manager | ~$0.40/secret/mo |

**Total: ~$20–25/month**

---

## Prerequisites

Install these before starting:

```bash
# AWS CLI v2
# https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
aws --version  # must be 2.x

# Node.js 20+
node --version

# AWS CDK
npm install -g aws-cdk

# psql (for DB migration)
# Windows: https://www.postgresql.org/download/windows/
```

---

## Step 1 — Configure AWS credentials

```bash
aws configure
# Enter:
#   AWS Access Key ID: <from IAM>
#   AWS Secret Access Key: <from IAM>
#   Default region: us-east-1
#   Default output format: json

# Verify:
aws sts get-caller-identity
```

Your IAM user needs these permissions: `AdministratorAccess` (or a custom policy with CDK deploy rights).

---

## Step 2 — Deploy all infrastructure

```bash
cd illuminate-pto

# Install infra deps
cd infra && npm install && cd ..

# Deploy (takes 15–25 minutes first time)
cd infra
npx cdk bootstrap
npx cdk deploy --outputs-file cdk-outputs.json
```

At the end you'll see outputs like:
```
IlluminatePtoStack.SiteUrl      = https://d1abc123.cloudfront.net
IlluminatePtoStack.UserPoolId   = us-east-1_XXXXXXX
IlluminatePtoStack.UserPoolClientId = 1abc2def3...
IlluminatePtoStack.DbEndpoint   = pto-db.xxxx.us-east-1.rds.amazonaws.com
IlluminatePtoStack.S3BucketName = illuminate-pto-frontend-123456789
```

---

## Step 3 — Write env vars and build frontend

```bash
# Parse CDK outputs → writes frontend/.env.production
node infra/scripts/write-env.js

# Build
cd frontend
npm install
npm run build
cd ..
```

---

## Step 4 — Deploy frontend to S3

```bash
# Get bucket name from outputs
BUCKET=$(cat infra/cdk-outputs.json | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).IlluminatePtoStack.S3BucketName))")
CF_ID=$(cat infra/cdk-outputs.json  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).IlluminatePtoStack.CloudFrontDistributionId))")

# Upload
aws s3 sync frontend/dist "s3://$BUCKET" --delete

# Invalidate cache
aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*"
```

---

## Step 5 — Run database migrations

RDS is in a private subnet. You have two options:

### Option A: AWS CloudShell (easiest, no setup)

1. Open [AWS CloudShell](https://console.aws.amazon.com/cloudshell)
2. Upload `backend/db/schema.sql` and `backend/db/seed.sql`
3. Get credentials:
   ```bash
   aws secretsmanager get-secret-value --secret-id illuminate-pto/db --query SecretString --output text
   ```
4. Run migrations:
   ```bash
   PGPASSWORD='<password_from_above>' psql \
     -h <DB_ENDPOINT_FROM_OUTPUTS> \
     -U pto_admin \
     -d pto \
     -f schema.sql
   
   PGPASSWORD='<password_from_above>' psql \
     -h <DB_ENDPOINT_FROM_OUTPUTS> \
     -U pto_admin \
     -d pto \
     -f seed.sql
   ```

### Option B: SSH tunnel from your machine

1. Create a bastion EC2 in the VPC's public subnet (t2.micro, Amazon Linux)
2. SSH tunnel: `ssh -L 5433:<RDS_ENDPOINT>:5432 ec2-user@<BASTION_IP>`
3. Run migrations locally: `PGPASSWORD='...' psql -h localhost -p 5433 -U pto_admin -d pto -f backend/db/schema.sql`

---

## Step 6 — Store your Anthropic API key

```bash
aws secretsmanager put-secret-value \
  --secret-id 'illuminate-pto/anthropic-key' \
  --secret-string '{"key":"sk-ant-YOUR_KEY_HERE"}'
```

---

## Step 7 — Create Cognito users

```bash
USER_POOL_ID=$(cat infra/cdk-outputs.json | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).IlluminatePtoStack.UserPoolId))")

# Create a user (they'll get a temp password email)
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "fdadrass@illuminate.net" \
  --user-attributes Name=email,Value=fdadrass@illuminate.net Name=email_verified,Value=true \
  --temporary-password "Temp1234!"

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "fdadrass@illuminate.net" \
  --group-name admin

# Add more users — use 'manager' or 'employee' groups
# Example: manager
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "mbocanegra@illuminate.net" \
  --user-attributes Name=email,Value=mbocanegra@illuminate.net Name=email_verified,Value=true \
  --temporary-password "Temp1234!"

aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "mbocanegra@illuminate.net" \
  --group-name manager
```

Users receive a temporary password email and are prompted to set a new one on first login.

---

## Step 8 — Link Cognito users to DB records

After each user logs in for the first time, their `cognito_sub` needs to be linked to their `users` row. You can do this with:

```sql
-- Run in psql after the user logs in (get their sub from Cognito console or CloudWatch)
UPDATE users SET cognito_sub = '<cognito-sub-uuid>' WHERE email = 'fdadrass@illuminate.net';
```

Or call the `/api/employees/:id/cognito` endpoint (PATCH) after first login.

---

## Role Matrix

| Feature | employee | manager | admin |
|---|---|---|---|
| View own PTO | ✓ | ✓ | ✓ |
| View team PTO | — | ✓ | ✓ |
| View all employees | — | — | ✓ |
| Submit own requests | ✓ | ✓ | ✓ |
| Submit for others | — | team | ✓ |
| Approve/deny | — | team | ✓ |
| Award bonus days | — | team | ✓ |
| Add employees | — | — | ✓ |
| Bulk import | — | — | ✓ |
| PDF import | ✓ | ✓ | ✓ |

---

## Local development

```bash
# 1. Start a local Postgres
docker run -d -e POSTGRES_DB=pto -e POSTGRES_USER=pto_admin -e POSTGRES_PASSWORD=localpassword -p 5432:5432 postgres:15

# 2. Run schema + seed
PGPASSWORD=localpassword psql -h localhost -U pto_admin -d pto -f backend/db/schema.sql
PGPASSWORD=localpassword psql -h localhost -U pto_admin -d pto -f backend/db/seed.sql

# 3. Set env (no Cognito needed locally — auth middleware auto-grants admin)
cd backend
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# 4. Start backend
npm install
npm run dev    # http://localhost:3001

# 5. Start frontend (in a new terminal)
cd frontend
npm install
npm run dev    # http://localhost:5173  (proxies /api → :3001)
```

---

## Tear down

```bash
cd infra
npx cdk destroy
# Note: RDS has SNAPSHOT removal policy — you'll need to manually delete the snapshot
# and the Cognito user pool is set to RETAIN (preserves users)
```

---

## Architecture diagram

```
Browser
  │
  ▼
CloudFront (d1abc123.cloudfront.net)  ← your live URL
  ├─ /*      →  S3 (React SPA)
  └─ /api/*  →  API Gateway (REST)
                    │
                    ▼ Cognito JWT verified in Lambda
                  Lambda (Express)
                    │
                    ▼
                  RDS PostgreSQL (private subnet)
```
