# ECS Workshop Application

A containerized full-stack web application deployed on AWS ECS Fargate. The frontend is a static site served by Nginx that proxies API requests to a Node.js/Express backend. Both services are built, pushed to ECR, and deployed via a GitHub Actions CI/CD pipeline using OIDC authentication.

## Architecture Overview

```
Internet → ALB (HTTPS/443) → Frontend (Nginx, port 80) → /api/* proxy → Internal ALB → Backend (Express, port 3000)
```

- **Frontend**: Nginx serving static HTML/CSS/JS, proxying `/api/` to the backend via ECS service discovery (`backend.ecsworkshop.local:3000`)
- **Backend**: Node.js/Express REST API with multiple endpoints
- **CI/CD**: GitHub Actions with AWS OIDC authentication — no static credentials

```
application-repo/
├── frontend/
│   ├── index.html          # Main application page
│   ├── style.css           # Application styling
│   ├── script.js           # Frontend logic (API calls)
│   ├── nginx.conf          # Nginx reverse proxy config
│   ├── Dockerfile          # nginx:alpine based image
│   └── .dockerignore
├── backend/
│   ├── index.js            # Express server with API endpoints
│   ├── package.json        # Node.js dependencies
│   ├── Dockerfile          # node:18-alpine based image
│   └── .dockerignore
└── .github/
    └── workflows/
        └── deploy.yml      # CI/CD pipeline (OIDC → ECR → ECS)
```

## Application Features

### Frontend (port 80)
- Responsive UI with greeting generator, calculator, text tools, and server info panels
- Live backend health indicator in the navbar
- All API calls proxied through Nginx to the backend

### Backend API (port 3000)

| Method | Endpoint        | Description                                      |
|--------|-----------------|--------------------------------------------------|
| GET    | `/api/health`   | Health check with uptime and timestamp            |
| POST   | `/api/greet`    | Greeting in 6 languages (English, Spanish, French, German, Japanese, Hindi) |
| POST   | `/api/calculate`| Calculator (add, subtract, multiply, divide)      |
| POST   | `/api/text`     | Text tools (uppercase, lowercase, title case, reverse, word/char count) |
| GET    | `/api/info`     | Server container info (hostname, platform, memory, CPUs) |

## Prerequisites

- **Docker** for building container images
- **Node.js 18+** for local backend development
- **AWS CLI** configured with access to the target account
- **Git** for version control

### AWS Infrastructure

This application depends on the ECS infrastructure stack from the companion repository:
[ecsworkshop-infra](https://github.com/PLT-AME-CLOUD/platform_infra_aws)

The infra repo provisions via Terraform:
- VPC, subnets, and security groups
- ECS Fargate cluster (`ecs-cluster`)
- ECR repository (`app-repo`)
- Public ALB (HTTPS) for the frontend, internal ALB for the backend
- Service discovery namespace (`ecsworkshop.local`)
- Auto-scaling policies
- IAM roles, ACM certificate, and Route 53 DNS

### GitHub Configuration

Required repository secret:
- `AWS_ROLE_ARN` — ARN of the IAM role configured for GitHub OIDC (set up in the infra repo's `bootstrap/` stack)

No static AWS credentials are needed. The workflow authenticates via OIDC (`id-token: write`).

## Local Development

```bash
# Clone and install
git clone https://github.com/PLT-AME-CLOUD/application-repo.git
cd application-repo/backend
npm install

# Run backend locally
npm start
# Backend available at http://localhost:3000

# Test health endpoint
curl http://localhost:3000/api/health
```

To test the full stack locally with Docker:

```bash
# Start backend
cd backend
docker build -t test-backend .
docker run -d -p 3000:3000 --name backend test-backend

# For local testing, uncomment the host.docker.internal line in frontend/nginx.conf
# and comment out the ECS upstream line, then:
cd ../frontend
docker build -t test-frontend .
docker run -d -p 8080:80 --name frontend test-frontend

# Visit http://localhost:8080

# Clean up
docker stop frontend backend && docker rm frontend backend
```

## Deployment

### Automated (CI/CD)

Every push to `main` triggers the GitHub Actions workflow which:

1. Builds Docker images for frontend and backend
2. Authenticates to AWS via OIDC (assumes `AWS_ROLE_ARN`)
3. Pushes images to ECR as `app-repo:frontend-latest` and `app-repo:backend-latest`
4. Updates ECS services with `--force-new-deployment` to pull new images

### Manual

```bash
# Authenticate to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/app-repo:frontend-latest frontend/
docker build -t <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/app-repo:backend-latest backend/
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/app-repo:frontend-latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/app-repo:backend-latest

# Deploy to ECS
aws ecs update-service --cluster ecs-cluster --service frontend-service --desired-count 1 --force-new-deployment
aws ecs update-service --cluster ecs-cluster --service backend-service --desired-count 1 --force-new-deployment
```

## Troubleshooting

| Issue | Check |
|-------|-------|
| Frontend can't reach backend | Verify `nginx.conf` upstream matches service discovery name; check ECS security groups allow port 3000 from internal ALB |
| OIDC role assumption fails | Confirm `application-repo` is listed in the bootstrap trust policy (`github_repos` variable) |
| Images not updating in ECS | Ensure `--force-new-deployment` is used; ECS won't re-pull a `:latest` tag otherwise |
| Container won't start | Check CloudWatch log groups `/ecs/frontend` and `/ecs/backend` |
| Health check failing | Backend must respond 200 on `GET /api/health`; frontend must respond 200 on `GET /` |
