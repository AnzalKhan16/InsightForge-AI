# Continuous Integration & Continuous Delivery (Phase 18)

## 1. Overview
The InsightForge AI CI/CD pipeline enforces automated quality gates, security audits, schema integrity verifications, and container build validations across all pull requests and branch merges into `main`.

```
               [ Push / Pull Request to main ]
                              |
        +---------------------+---------------------+
        |                     |                     |
        v                     v                     v
 [ backend-qa ]         [ frontend-qa ]     [ security-audit ]
 - Ruff Linting         - TypeScript Types  - Gitleaks Secrets
 - Real Postgres Migr   - Vitest Tests      - pip-audit Vulnerabilities
 - Alembic Drift Check  - Next.js Build     - npm audit Vulnerabilities
 - 72 Pytest Tests
        \                     /
         \                   /
          v                 v
       [ docker-verification ]
       - Compose Config Validation (Base, Dev, Prod)
       - Buildx Backend Multi-Stage Compilation
       - Buildx Frontend Multi-Stage Compilation
```

---

## 2. Pipeline Jobs & Matrix

### Job 1: `backend-qa`
- **Runner**: `ubuntu-latest`
- **Service Containers**:
  - PostgreSQL 16 (`postgres:16-alpine`) with healthcheck
  - Redis 7 (`redis:7-alpine`) with healthcheck
- **Steps**:
  1. Python 3.11 environment initialization with pip dependency caching.
  2. Static linting & code style enforcement via **Ruff**.
  3. Migration idempotency & schema drift check:
     - `alembic upgrade head`
     - `alembic check` (verifies zero drift between SQLAlchemy models and DB schema)
     - `alembic downgrade base` (verifies full rollback support)
     - `alembic upgrade head`
  4. Full test suite execution via **Pytest** (72 integration & unit tests).

### Job 2: `frontend-qa`
- **Runner**: `ubuntu-latest`
- **Node Runtime**: Node.js 22 with npm lockfile caching.
- **Steps**:
  1. Clean dependency installation (`npm ci`).
  2. TypeScript static typechecking & linting (`npm run lint` / `tsc --noEmit`).
  3. Unit and component testing via **Vitest** (`npm test`).
  4. Production bundle compilation verification (`npm run build`).

### Job 3: `docker-verification`
- **Dependency**: Runs after `backend-qa` and `frontend-qa` pass.
- **Steps**:
  1. Syntax validation of `docker-compose.yml`, `docker-compose.dev.yml`, and `docker-compose.prod.yml`.
  2. Docker Buildx multi-stage compilation for backend image (`insightforge-backend:ci`).
  3. Docker Buildx multi-stage compilation for frontend image (`insightforge-frontend:ci`).
  4. Build caching via GitHub Actions cache backend (`type=gha`).

### Job 4: `security-audit`
- **Runner**: `ubuntu-latest`
- **Steps**:
  1. Secret detection across git history via **Gitleaks** to prevent credential/API key leaks.
  2. Known CVE vulnerability audit of Python dependencies via **pip-audit**.
  3. Node.js dependency vulnerability audit via **npm audit**.

---

## 3. GitHub Environment Secrets & Configuration
To configure production continuous deployment in GitHub Actions:
- `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` (optional, for registry push)
- `PROD_SSH_HOST`, `PROD_SSH_USER`, `PROD_SSH_KEY` (for production server CD trigger)
