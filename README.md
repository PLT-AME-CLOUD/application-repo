# ECS Workshop Application

A containerized full-stack web application deployed on AWS ECS Fargate. The frontend is a static site served by Nginx that proxies API requests to a Node.js/Express backend. Separate CI and CD pipelines handle image building, vulnerability scanning, approval gating, and deployment — all authenticated via GitHub OIDC.

## Architecture Overview

```
Internet → ALB (HTTPS/443) → Frontend (Nginx, port 80) → /api/* proxy → Internal ALB (HTTP/80) → Backend (Express, port 3000)
```

- **Frontend**: Nginx serving static HTML/CSS/JS, proxying `/api/` to the backend via the internal ALB (injected at startup from the `BACKEND_URL` environment variable)
- **Backend**: Node.js/Express REST API with multiple endpoints including auto-scaling load testing
- **CI/CD**: Two-pipeline setup with OIDC authentication, ECR vulnerability scanning, and manual approval gates

```
application-repo/
├── frontend/
│   ├── index.html              # Main application page
│   ├── style.css               # Application styling
│   ├── script.js               # Frontend logic (API calls, load test monitor)
│   ├── nginx.conf              # Nginx reverse proxy template (uses $BACKEND_URL)
│   ├── entrypoint.sh           # Substitutes env vars into nginx config at startup
│   ├── Dockerfile              # nginx:alpine based image
│   └── .dockerignore
├── backend/
│   ├── index.js                # Express server with API and stress test endpoints
│   ├── package.json            # Node.js dependencies
│   ├── Dockerfile              # node:18-alpine based image
│   └── .dockerignore
└── .github/
    └── workflows/
        ├── ci.yml              # CI: build, push, scan (feature branches)
        └── deploy.yml          # CD: verify CI, approve, deploy (main)
```

## CI/CD Pipelines

### CI Pipeline (`ci.yml`) — Feature branches only

Triggered on every push to any branch except `main`.

| Step | Commit Status | Description |
|------|---------------|-------------|
| Build frontend | `ci/frontend-build` | Builds and pushes image tagged `frontend-<commit-sha>` to ECR |
| Build backend | `ci/backend-build` | Builds and pushes image tagged `backend-<commit-sha>` to ECR |
| Vulnerability scan | `ci/image-scan` | Waits for ECR Basic scan results; passes even with critical/high findings (logs warnings) |

Images are tagged with the full commit SHA for immutability — no `:latest` tags in CI.

### CD Pipeline (`deploy.yml`) — Main branch only

Triggered on every push to `main`. Does **not** rebuild images.

| Step | Commit Status | Description |
|------|---------------|-------------|
| Verify CI | `cd/verify-ci` | Checks that `ci/frontend-build`, `ci/backend-build`, and `ci/image-scan` all passed on this commit |
| Approval | `cd/approval` | Waits for manual approval via the `production` GitHub environment |
| Deploy | `cd/deploy-ecs` | Registers new ECS task definitions pointing to the CI-built `<service>-<commit-sha>` images and updates services |

### GitHub Setup

**Required secret:**
- `AWS_ROLE_ARN` — IAM role ARN configured for GitHub OIDC (from the infra repo's `bootstrap/` stack)

**Required environment:**
- Create a `production` environment in repo Settings > Environments with required reviewers for the approval gate

No static AWS credentials are needed. Both pipelines authenticate via OIDC (`id-token: write`).

## Application Features

### Frontend (port 80)
- Responsive UI with greeting generator, calculator, text tools, server info, and auto-scaling load test panels
- Live backend health indicator in the navbar
- Real-time resource monitor during stress tests (memory meters, hostname tracking)
- All API calls proxied through Nginx to the backend

### Backend API (port 3000)

| Method | Endpoint             | Description |
|--------|----------------------|-------------|
| GET    | `/api/health`        | Health check with uptime and timestamp |
| POST   | `/api/greet`         | Greeting in 6 languages (English, Spanish, French, German, Japanese, Hindi) |
| POST   | `/api/calculate`     | Calculator (add, subtract, multiply, divide) |
| POST   | `/api/text`          | Text tools (uppercase, lowercase, title case, reverse, word/char count) |
| GET    | `/api/info`          | Server container info (hostname, platform, memory, CPUs) |
| POST   | `/api/stress`        | Start CPU or memory stress test (configurable duration, 5–300s) |
| GET    | `/api/stress/status` | Live resource usage and stress test state |

### Auto-Scaling Load Test

The stress test endpoints let you trigger ECS auto-scaling during a demo:

- **CPU stress**: Spawns worker threads that burn CPU in tight loops. The main thread stays responsive for health checks.
- **Memory stress**: Allocates 300 MB of buffers (~74% of the 512 MB task limit), exceeding the 50% scaling threshold.
- **Scaling thresholds**: Configurable in Terraform via `scaling_cpu_threshold` and `scaling_memory_threshold` (default 50%).

## Prerequisites

- **Docker** for building container images
- **Node.js 18+** for local backend development
- **AWS CLI** configured with access to the target account
- **Git** for version control

### AWS Infrastructure

This application depends on the ECS infrastructure stack from the companion repository:
[ecsworkshop-infra](https://github.com/PLT-AME-CLOUD/platform_infra_aws)

The infra repo provisions via Terraform:
- VPC, subnets, security groups, and VPC endpoints (ECR, S3, CloudWatch Logs)
- ECS Fargate cluster (`ecs-cluster`)
- ECR repository (`app-repo`) with scan-on-push enabled
- Public ALB (HTTPS) for the frontend, internal ALB for the backend
- Auto-scaling policies (CPU and memory target tracking)
- IAM roles, ACM certificate, and Route 53 DNS

## Local Development

```bash
# Clone and install
git clone https://github.com/PLT-AME-CLOUD/application-repo.git
cd application-repo/backend
npm install

# Run backend locally
npm start
# Backend available at http://localhost:3000

# Test endpoints
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/greet -H 'Content-Type: application/json' -d '{"name":"World","language":"english"}'
```

To test the full stack locally with Docker:

```bash
# Start backend
cd backend
docker build -t test-backend .
docker run -d -p 3000:3000 --name backend test-backend

# Start frontend (set BACKEND_URL for the nginx proxy)
cd ../frontend
docker build -t test-frontend .
docker run -d -p 8080:80 -e BACKEND_URL=http://host.docker.internal:3000 --name frontend test-frontend

# Visit http://localhost:8080

# Clean up
docker stop frontend backend && docker rm frontend backend
```

## Troubleshooting

| Issue | Check |
|-------|-------|
| Frontend can't reach backend | Verify `BACKEND_URL` env var is set in the ECS task definition; check security groups allow port 3000 from internal ALB |
| OIDC role assumption fails | Confirm `application-repo` is in the bootstrap trust policy (`github_repos` variable); wildcards must handle `@<id>` suffixes in GitHub's OIDC sub claim |
| CD says "CI checks not satisfied" | CI must run on the commit before it reaches main — push to a feature branch first, then merge |
| ECR scan not running | Images must be Docker V2 format; `--provenance=false` on `docker build` prevents OCI manifests that Basic scanning can't process |
| Container OOM killed (SIGKILL) | Memory stress allocates 300 MB; with Node.js overhead (~60-80 MB) this stays under the 512 MB task limit. If adding code, keep RSS below 450 MB |
| Health check failing | Backend must respond 200 on `GET /api/health`; frontend must respond 200 on `GET /` |
| Auto-scaling not triggering | Check CloudWatch metrics for `ECSServiceAverageCPUUtilization` / `ECSServiceAverageMemoryUtilization`; scaling needs sustained load above the threshold (default 50%) for ~3 minutes |
