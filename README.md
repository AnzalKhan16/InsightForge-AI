# InsightForge AI

Enterprise-grade, deterministic business intelligence and strategic AI analytics platform.

- **Frontend**: Next.js 14, React, Tailwind CSS, Lucide Icons, Recharts
- **Backend API**: FastAPI, Python 3.11, SQLAlchemy 2.0, PostgreSQL, Redis, Scikit-learn, Statsmodels
- **Storage & ML**: Multi-format parsing (CSV, Excel), RFM segmentation, Holt Linear & ARIMA forecasting, IQR & Isolation Forest anomaly audits, Boardroom executive reports (.html, .md, /view).

---

## Architecture & Documentation
- [Architecture Blueprint](docs/architecture.md)
- [Conventions & Standards](docs/conventions.md)
- [Database Schema & Migrations](docs/database.md)
- [Predictive Forecasting Engine](docs/forecasting.md)
- [Anomaly Detection Audit](docs/anomaly_detection.md)
- [Customer & Entity Segmentation](docs/segmentation.md)
- [Executive Report Generation](docs/report_generation.md)
- [Comprehensive QA Testing Matrix](docs/comprehensive_testing.md)
- [Docker Containerization & Deployment](docs/docker_deployment.md)

---

## Status & Roadmap
- [x] Phase 0 — Architecture Planning
- [x] Phase 1 — Project Foundation
- [x] Phase 2 — Database & Data Architecture
- [x] Phase 3 — Authentication & Workspaces
- [x] Phase 4 — Data Ingestion & Storage Pipeline
- [x] Phase 5 — Dataset Profiling
- [x] Phase 6 — Data Cleaning Pipeline
- [x] Phase 7 — Analytics Engine (Aggregation & Trends)
- [x] Phase 8 — Natural Language Query Interface
- [x] Phase 9 — Strategic AI Insights Engine
- [x] Phase 10 — Interactive Analytics Dashboard
- [x] Phase 11 — Interactive Dashboard Navigation & Visualizations
- [x] Phase 12 — Time-Series Forecasting Engine
- [x] Phase 13 — Data Anomaly Detection Audit
- [x] Phase 14 — Customer & Product Segmentation (RFM / K-Means)
- [x] Phase 15 — Boardroom Executive Briefing & Report Generation
- [x] Phase 16 — Comprehensive QA & Security Testing (86/86 Tests Passed)
- [x] Phase 17 — Docker Containerization (Decoupled Multi-Service Stack)
- [ ] Phase 18 — CI/CD Pipeline
- [ ] Phase 19 — Production Deployment

---

## Quickstart with Docker Compose

### 1. Configure Environment
```bash
cp .env.example .env
```

### 2. Run Local Development Stack (with Hot-Reloading)
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### 3. Run Production Stack (Hardened & Resource-Constrained)
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

- **Frontend Web Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
