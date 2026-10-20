# Production Deployment & Operations Architecture (Phase 19)

## 1. Production Architecture Overview
InsightForge AI is designed for resilient, scalable cloud or on-premise execution. The production architecture segregates concerns across stateless computation, managed persistence, asynchronous worker queues, and reverse-proxy caching.

```
                           [ Internet Traffic ]
                                    |
                                    v (HTTPS: 443)
                    +-------------------------------+
                    |  Cloudflare / AWS ALB / Nginx |
                    |  SSL Termination & Rate Limit |
                    +-------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
     (Web: Port 3000)                                (API: Port 8000)
            |                                               |
            v                                               v
  +--------------------+                         +--------------------+
  | Next.js Frontend   |                         |  FastAPI Backend   |
  | (2+ Replicas)      |                         |  (2+ Replicas)     |
  +--------------------+                         +--------------------+
                                                            |
                             +------------------------------+------------------------------+
                             |                              |                              |
                             v                              v                              v
                    +--------------------+        +--------------------+        +--------------------+
                    |  PostgreSQL 16     |        |   Redis 7 Cache    |        |  S3 / Object Store |
                    |  (RDS / HA Cluster)|        |  (Cluster / Queue) |        | (Dataset Artifacts)|
                    +--------------------+        +--------------------+        +--------------------+
                             ^                              ^                              ^
                             |                              |                              |
                             +------------------------------+------------------------------+
                                                            |
                                                            v
                                                   +--------------------+
                                                   | Background Workers |
                                                   | (Profiling/ML/Rec) |
                                                   +--------------------+
```

---

## 2. Infrastructure & Hosting Options

### Option A: Managed Cloud Infrastructure (AWS / GCP / Azure)
- **Frontend & Backend**: AWS ECS Fargate or GCP Cloud Run (stateless, auto-scaling containers).
- **Database**: AWS Aurora PostgreSQL / GCP Cloud SQL (automated daily backups, point-in-time recovery).
- **Redis**: AWS ElastiCache for Redis / GCP Memorystore.
- **Object Storage**: AWS S3 / Google Cloud Storage for persistent dataset storage (`IF_STORAGE_BACKEND=s3`).

### Option B: Containerized Single/Multi-Node VM (Ubuntu 22.04 / 24.04 LTS)
- Deploy via `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.
- Fronted by the production Nginx configuration in `infra/nginx/nginx.conf`.
- Automated systemd service or Docker restart policies.

---

## 3. Production Environment Configuration & Secrets Management

### Secret Generation & Rules
Never commit plain-text credentials to version control. Production environment variables must be injected via a secret store (e.g. AWS Secrets Manager, HashiCorp Vault, Doppler, or GitHub Secrets):

```bash
# Generate 64-character cryptographic secrets
export IF_SECRET_KEY=$(openssl rand -hex 32)
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
```

### Essential Production Variables
```ini
IF_ENVIRONMENT=production
IF_DEBUG=false
IF_SECRET_KEY=<64_hex_chars>
IF_CORS_ORIGINS=https://app.yourdomain.com
IF_DATABASE_URL=postgresql+psycopg://user:password@db-host:5432/insightforge_prod
IF_REDIS_URL=redis://redis-host:6379/0
IF_STORAGE_BACKEND=s3
IF_STORAGE_LOCAL_DIR=/app/data/raw
```

---

## 4. Zero-Downtime Database Migration Strategy
Database schema changes follow the **Expand and Contract Pattern** to ensure zero downtime during rolling updates:

1. **Phase 1 (Expand)**: Add new nullable columns or tables. Existing running services continue operating normally without breakage.
2. **Phase 2 (Migrate)**: Run `alembic upgrade head` through deployment pipeline:
   ```bash
   docker compose run --rm backend alembic upgrade head
   ```
3. **Phase 3 (Deploy)**: Roll out new container versions that read and write to the updated schema.
4. **Phase 4 (Contract)**: After older instances are fully retired, drop obsolete columns in a subsequent non-breaking migration.
5. **Non-Blocking Indexes**: For high-volume tables, create PostgreSQL indexes using `CONCURRENTLY` to avoid table write locks.

---

## 5. Automated Deployment & Operations Scripts

| Script | Purpose | Command |
| :--- | :--- | :--- |
| **`scripts/deploy.sh`** | Pre-flight validation, image building, DB migrations, rolling restart, and readiness probe verification | `./scripts/deploy.sh` |
| **`scripts/backup.sh`** | Automated PostgreSQL compressed dump + object storage volume backup with 14-day rotation | `./scripts/backup.sh` |
| **`scripts/restore.sh`** | Complete disaster recovery restoration of database and storage from compressed backups | `./scripts/restore.sh backups/db.sql.gz` |
| **`scripts/rollback.sh`** | Emergency rollback to previous Git commit/image tag with optional Alembic downgrade | `./scripts/rollback.sh HEAD~1` |

---

## 6. Health Checks, Monitoring & Observability

### Healthcheck Probes
- **Liveness Probe**: `GET /api/v1/health/live` (Returns HTTP 200 as long as the process loop is responsive).
- **Readiness Probe**: `GET /api/v1/health/ready` (Executes `SELECT 1` on PostgreSQL and verifies storage accessibility; returns HTTP 503 if downstream database is degraded).

### Logging & Metrics
- Container logs use JSON formatting (`json-file`) with log rotation (`max-size: 30m`, `max-file: 5`) to prevent disk exhaustion.
- Ready for integration with FluentBit, Datadog Agent, or Promtail/Loki.

---

## 7. Scaling & Performance Guidelines
1. **Database Connection Pooling**: Default pool size is 5 per process with 10 max overflow. For multi-container deployments exceeding 100 backend replicas, deploy **PgBouncer** in transaction pooling mode.
2. **Background Worker Scaling**: The `worker` container is horizontally scalable:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=4
   ```
3. **Frontend CDN Caching**: Route Next.js static assets (`/_next/static/*`) through Cloudflare or CloudFront with `Cache-Control: public, max-age=31536000, immutable`.
