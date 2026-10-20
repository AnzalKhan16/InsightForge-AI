# Docker Containerization & Deployment Guide (Phase 17)

## 1. Overview & Service Topology
InsightForge AI is fully containerized across five decoupled, micro-orchestrated services connected through an isolated bridge network (`insightforge_network`):

```
                       +----------------------------------+
                       |      Host / Reverse Proxy        |
                       +----------------------------------+
                                  |            |
                           Port 3000          Port 8000
                                  |            |
                                  v            v
  +---------------------------------+        +---------------------------------+
  |      insightforge-frontend      |        |       insightforge-backend      |
  |     (Next.js 14, Node 22)       |------->|      (FastAPI, Python 3.11)     |
  +---------------------------------+        +---------------------------------+
                                                              |
                                           +------------------+------------------+
                                           |                                     |
                                           v                                     v
                       +---------------------------------+   +---------------------------------+
                       |      insightforge-postgres      |   |       insightforge-redis        |
                       |       (PostgreSQL 16)           |   |           (Redis 7)             |
                       +---------------------------------+   +---------------------------------+
                                           ^                                     ^
                                           |                                     |
                                           +------------------+------------------+
                                                              |
                                             +---------------------------------+
                                             |       insightforge-worker       |
                                             |  (Async Job & Queue Processor)  |
                                             +---------------------------------+
```

### Services Breakdown
1. **`frontend`** (`insightforge-frontend`): Multi-stage Next.js runtime (Node 22-alpine), non-root `nextjs` user (UID 10001), port `3000`.
2. **`backend`** (`insightforge-backend`): Multi-stage Python 3.11-slim API runtime, non-root `appuser` (UID 10001), port `8000`, built-in curl healthcheck against `/api/v1/health`.
3. **`worker`** (`insightforge-worker`): Background task execution container running `app.worker` for asynchronous profiling, data cleaning, and heavy ML jobs.
4. **`db`** (`insightforge-postgres`): PostgreSQL 16-alpine with volume persistence (`postgres_data`) and `pg_isready` healthcheck.
5. **`redis`** (`insightforge-redis`): Redis 7-alpine for caching and queue coordination with volume persistence (`redis_data`) and ping healthcheck.

---

## 2. Directory Structure & Compose Files

```
InsightForge-AI/
├── .env.example              # Root compose environment sample
├── docker-compose.yml        # Base orchestration definition
├── docker-compose.dev.yml    # Development overlay (live code mounts & debug)
├── docker-compose.prod.yml   # Production overlay (resource limits, rotation, restart)
├── backend/
│   ├── Dockerfile            # Multi-stage secure backend image
│   ├── .dockerignore         # Excludes venv, sqlite, pycache
│   └── .env.example          # Backend environment sample
└── frontend/
    ├── Dockerfile            # Multi-stage secure Next.js image
    ├── .dockerignore         # Excludes node_modules, .next
    └── .env.example          # Frontend environment sample
```

---

## 3. Quickstart: Local Development

### 1. Environment Preparation
```bash
cp .env.example .env
```

### 2. Launch Development Stack
Mounts host source code for live hot-reloading:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- **Frontend**: http://localhost:3000
- **Backend API & Swagger Docs**: http://localhost:8000/docs
- **Healthcheck**: http://localhost:8000/api/v1/health

---

## 4. Production Deployment

### 1. Configure Production Secrets
Set strict non-debug production variables in `.env`:
```bash
IF_ENVIRONMENT=production
IF_DEBUG=false
IF_SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
```

### 2. Start Production Containers
Applies restart policies (`always`), resource limits (CPU/Memory), and JSON-file log rotation:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 3. Apply Database Migrations
Run schema migrations within the running backend container:
```bash
docker compose exec backend alembic upgrade head
```

---

## 5. Security & Isolation Hardening
- **Non-Root Execution**: Both `backend` (`appuser`: 10001) and `frontend` (`nextjs`: 10001) execute as non-root users.
- **Isolated Network**: All inter-service database and cache communication occurs over the internal bridge network `insightforge_network`.
- **Healthcheck Cascades**: The `backend` and `worker` services declare explicit dependency conditions (`condition: service_healthy`), ensuring they only initialize after PostgreSQL and Redis pass verification.
- **Persistent Data Protection**: Database records, cache dumps, and uploaded file objects persist in named Docker volumes (`postgres_data`, `redis_data`, `storage_data`).
