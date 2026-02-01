# ClubhouseWidget AWS Deployment Steps

## Pre-Deployment Checklist

| Item | Status | Notes |
|------|--------|-------|
| Aurora schema SQL | ✅ Ready | `migrations/aurora/001_initial_schema.sql` |
| Lambda backend code | ✅ Ready | `lambda/src/` - Express.js + TypeScript |
| Dockerfile | ✅ Ready | ARM64 Lambda container |
| Terraform config | ✅ Ready | `infrastructure/widgets/clubhouse/` |
| Frontend API service | ✅ Ready | `frontend/src/services/api-lambda.ts` |
| CI/CD workflow | ✅ Ready | `.github/workflows/deploy.yml` |

---

## Step 1: Install Lambda Dependencies

```bash
cd ClubhouseWidget/lambda
npm install
```

Verify build works:
```bash
npm run build
```

---

## Step 2: Run Aurora Database Migration

Connect to Aurora and execute the schema:

```bash
# Option A: Using psql directly
psql -h alpb-1.cluster-cx866cecsebt.us-east-2.rds.amazonaws.com \
     -U slugger -d slugger \
     -f migrations/aurora/001_initial_schema.sql

# Option B: Via bastion/jump host if not directly accessible
ssh bastion-host "psql -h alpb-1.cluster-cx866cecsebt.us-east-2.rds.amazonaws.com -U slugger -d slugger" < migrations/aurora/001_initial_schema.sql
```

Verify tables created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'clubhouse_%';
```

Expected output:
- `clubhouse_teams`
- `clubhouse_users`
- `clubhouse_tasks`
- `clubhouse_games`
- `clubhouse_meals`
- `clubhouse_inventory`

---

## Step 3: Store Database Password in SSM

```bash
aws ssm put-parameter \
  --name "/slugger/clubhouse/db-password" \
  --value "YOUR_DB_PASSWORD_HERE" \
  --type SecureString \
  --region us-east-2
```

---

## Step 4: Deploy Terraform Infrastructure

```bash
cd infrastructure/widgets/clubhouse

# Initialize Terraform
terraform init

# Review the plan
terraform plan -out=tfplan

# Apply (creates ECR, Lambda, ALB rules)
terraform apply tfplan
```

**Note:** Lambda will fail initially because ECR has no image yet. This is expected.

---

## Step 5: Build and Push Initial Docker Image

```bash
# Set variables
AWS_ACCOUNT_ID=746669223415
AWS_REGION=us-east-2
ECR_REPO=widget-clubhouse

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build frontend
cd ClubhouseWidget/frontend
npm ci
npm run build

# Copy frontend to Lambda public folder
mkdir -p ../lambda/public
cp -r dist/* ../lambda/public/

# Build Lambda
cd ../lambda
npm ci
npm run build

# Build Docker image (ARM64 for Graviton2)
docker build --platform linux/arm64 -t $ECR_REPO .

# Tag and push
docker tag $ECR_REPO:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest
```

---

## Step 6: Update Lambda Function

```bash
aws lambda update-function-code \
  --function-name widget-clubhouse \
  --image-uri $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest \
  --region $AWS_REGION

# Wait for update to complete
aws lambda wait function-updated --function-name widget-clubhouse --region $AWS_REGION
```

---

## Step 7: Set Lambda Environment Variables

Update the Lambda to include the database password:

```bash
aws lambda update-function-configuration \
  --function-name widget-clubhouse \
  --environment "Variables={
    PORT=8080,
    BASE_PATH=/widgets/clubhouse,
    COGNITO_USER_POOL_ID=us-east-2_tG7IQQ6G7,
    COGNITO_CLIENT_ID=YOUR_CLIENT_ID,
    DB_HOST=alpb-1.cluster-cx866cecsebt.us-east-2.rds.amazonaws.com,
    DB_NAME=slugger,
    DB_USER=slugger,
    DB_PASSWORD=YOUR_DB_PASSWORD
  }" \
  --region $AWS_REGION
```

**Alternative:** Modify `lambda/src/db/pool.ts` to read from SSM at runtime.

---

## Step 8: Verify Deployment

### Health Check
```bash
curl https://slugger-alb-1518464736.us-east-2.elb.amazonaws.com/widgets/clubhouse/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "ClubhouseWidget Lambda is running",
  "timestamp": "2026-02-01T...",
  "basePath": "/widgets/clubhouse"
}
```

### API Check
```bash
curl https://slugger-alb-1518464736.us-east-2.elb.amazonaws.com/widgets/clubhouse/api
```

### Test Teams Endpoint (no auth required)
```bash
curl https://slugger-alb-1518464736.us-east-2.elb.amazonaws.com/widgets/clubhouse/api/teams
```

---

## Step 9: Configure GitHub Actions (for CI/CD)

Add the following secret to your GitHub repository:

| Secret Name | Value |
|-------------|-------|
| `AWS_DEPLOY_ROLE_ARN` | ARN of IAM role with ECR/Lambda permissions |

The role needs these permissions:
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:GetDownloadUrlForLayer`
- `ecr:BatchGetImage`
- `ecr:PutImage`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`
- `lambda:UpdateFunctionCode`
- `lambda:GetFunction`

---

## Step 10: Update Frontend to Use Lambda API

When ready to switch from Supabase to Lambda:

1. Update imports in components:
```typescript
// Before
import { userApi, taskApi } from '../services/api';

// After
import { userApi, taskApi } from '../services/api-lambda';
```

2. Or create a feature flag in `api.ts`:
```typescript
const USE_LAMBDA = process.env.VITE_USE_LAMBDA === 'true';
export * from USE_LAMBDA ? './api-lambda' : './api-supabase';
```

---

## Troubleshooting

### Lambda 502 Bad Gateway
1. Check CloudWatch logs: `/aws/lambda/widget-clubhouse`
2. Increase timeout in Terraform (currently 30s)
3. Verify VPC configuration allows outbound to Aurora

### Database Connection Failed
1. Verify security group allows Lambda → Aurora (port 5432)
2. Check DB_PASSWORD environment variable
3. Test from EC2 in same VPC

### No CloudWatch Logs
Lambda in VPC cannot reach CloudWatch without:
- NAT Gateway (for private subnets)
- VPC Endpoint for `com.amazonaws.us-east-2.logs`

### Authentication Errors
1. Verify `COGNITO_USER_POOL_ID` matches SLUGGER
2. Check JWT token is being passed in cookie or Authorization header

---

## Rollback Procedure

If deployment fails:

```bash
# Revert to previous Lambda image
aws lambda update-function-code \
  --function-name widget-clubhouse \
  --image-uri $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:previous-tag

# Or destroy Terraform resources
cd infrastructure/widgets/clubhouse
terraform destroy
```

---

## Post-Deployment Tasks

- [ ] Migrate existing Supabase data to Aurora (if needed)
- [ ] Update SLUGGER shell to route to new widget URL
- [ ] Monitor CloudWatch for errors
- [ ] Set up CloudWatch alarms for Lambda errors/duration
- [ ] Remove Supabase dependencies from frontend after verification
