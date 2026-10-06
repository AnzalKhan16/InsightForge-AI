# Database Architecture & Data Lifecycle

Status: Phase 2. Code: `backend/app/db/`, migrations: `backend/alembic/`.

## 1. Principles
1. **PostgreSQL stores metadata and small structured results only.** Dataset bytes (raw uploads, parquet) live in object storage; the DB holds *pointers* (`storage_key`) plus checksums/sizes.
2. **Workspace = tenant boundary.** Every business table has a non-null `workspace_id` (FK, indexed). Repositories for these tables *require* a `workspace_id` argument (`WorkspaceScopedRepository`), so cross-tenant access is structurally impossible through the access layer.
3. **Results are tied to dataset versions**, not datasets, so an insight/forecast always refers to the exact data it was computed from.
4. **Deterministic vs AI is explicit** in the data: `insights.source` is `deterministic` or `ai`; AI insights carry `evidence` (the structured facts they were grounded in), `model_name`, `prompt_version`.
5. Constraints live in the database (FKs, CHECKs, partial unique indexes), not only in application code.

## 2. Entity overview
```mermaid
erDiagram
  users ||--o{ workspace_memberships : has
  workspaces ||--o{ workspace_memberships : has
  workspaces ||--o{ datasets : owns
  datasets ||--o{ dataset_versions : versions
  dataset_versions ||--o| dataset_metadata : profile
  dataset_versions ||--o{ dataset_artifacts : derived_files
  dataset_versions ||--o{ processing_jobs : jobs
  dataset_versions ||--o{ saved_analyses : analyses
  dataset_versions ||--o{ insights : insights
  dataset_versions ||--o{ forecasts : forecasts
  dataset_versions ||--o{ anomalies : anomalies
  dataset_versions ||--o{ segments : segments
  datasets ||--o{ dashboards : shown_in
  datasets ||--o{ reports : reported_in
  saved_analyses ||--o{ insights : grounds
```

| Table | Purpose | Key constraints / indexes |
|---|---|---|
| `users` | accounts (password hash filled in Phase 3) | unique `lower(email)` |
| `workspaces` | tenants | unique `slug`; index `owner_id` |
| `workspace_memberships` | user<->workspace + role (`owner/admin/member/viewer`) | unique `(workspace_id, user_id)` |
| `datasets` | logical dataset, soft-deleted via `deleted_at` | unique `(workspace_id, name)` among non-deleted (partial index) |
| `dataset_versions` | one row per upload; points to the **raw** file | unique `(dataset_id, version_number)`; **partial unique** `(dataset_id) WHERE is_current` = one current version; CHECK size >= 0, version >= 1, 64-char checksum; index `(workspace_id, status)` |
| `dataset_artifacts` | pointers to **derived** files (processed/cleaned parquet) | unique `(version_id, kind)` |
| `dataset_metadata` | schema + profile + quality (JSONB), 1:1 with version | unique `version_id` |
| `processing_jobs` | durable background-job record (queue-agnostic) | CHECK progress 0..100; index `(workspace_id, status)`, `(version_id, job_type)` |
| `dashboards` | saved layouts (references to analyses, not data) | index `(workspace_id, created_at)` |
| `saved_analyses` | deterministic query spec + small structured result | index `(workspace_id, created_at)` |
| `insights` | findings, deterministic or AI, with `evidence` | index `(workspace_id, version_id)` |
| `forecasts` | model, params, metrics, result points | CHECK horizon > 0 |
| `anomalies` | flagged rows/values with method, score, status | index `(workspace_id, version_id, status)` |
| `segments` | segments of a segmentation run (`run_id` groups them) | CHECK member_count >= 0 |
| `reports` | structured report content + optional rendered file key | index `(workspace_id, created_at)` |

Enums (`app/db/enums.py`) are stored as `VARCHAR` + `CHECK` (not native PG enums) so adding values is a simple migration.
Primary keys are UUIDv4 (non-guessable in URLs). Timestamps are `timestamptz`; `created_at`/`updated_at` have server defaults.

## 3. Data boundaries
| Layer | Where it lives | Mutability | Table(s) |
|---|---|---|---|
| **Raw data** | object storage: `workspaces/{ws}/datasets/{ds}/v{n}/raw/{filename}` | immutable | `dataset_versions.raw_storage_key` |
| **Processed analytical data** | object storage: `.../v{n}/processed/data.parquet` (and `cleaned/`) | reproducible from raw | `dataset_artifacts` |
| **Metadata / profile** | PostgreSQL JSONB | rewritten when re-profiled | `dataset_metadata` |
| **Analytics / ML results** | PostgreSQL (small structured outputs only) | per version | `saved_analyses`, `forecasts`, `anomalies`, `segments` |
| **AI-generated insights** | PostgreSQL | immutable once created; regenerate instead of edit | `insights` (`source='ai'`) |

Only the last three rows are ever candidates for LLM context, and only as aggregates/evidence, never raw rows (see architecture.md).

## 4. Data lifecycle
1. **Create dataset** -> `datasets` row. **Upload** -> bytes to object storage, `dataset_versions` row (`status=uploaded`, checksum, size, key), previous version demoted (`is_current=false`) in the same transaction (`DatasetRepository.add_version`).
2. **Process** -> a `processing_jobs` row (`queued -> running -> succeeded/failed`); version status moves `uploaded -> processing -> completed/failed`.
3. **Profile** -> `dataset_metadata` upserted; processed parquet registered in `dataset_artifacts`.
4. **Analyse** -> `saved_analyses`, `forecasts`, `anomalies`, `segments` reference the version.
5. **Insight/report** -> `insights` (with `evidence`), `reports`.
6. **Replace** -> new version; older versions and their results remain (history) until deleted.
7. **Delete** -> dataset is *soft-deleted* (`deleted_at`), name becomes reusable. A later purge job hard-deletes the row (FK `ON DELETE CASCADE` removes versions, artifact rows, results) and the storage prefix. DB cascade does **not** delete files, so the purge job must remove the storage prefix first.

## 5. Access layer
`app/db/repositories/`: repositories own all SQL; they `flush` but never `commit` (the request/job owns the transaction; `get_db` commits on success, rolls back on error). Tenant-owned entities are accessed via `get_in_workspace` / `list_in_workspace` / `get_active`.
Defence in depth for later: PostgreSQL Row-Level Security keyed on a per-transaction `app.workspace_id` setting (not implemented yet).

## 6. Migrations (Alembic)
```bash
cd backend
alembic upgrade head                              # apply
alembic revision --autogenerate -m "describe"     # after changing models; ALWAYS review the file
alembic check                                     # fails if models and migrations drift
alembic downgrade -1
```
`IF_DATABASE_URL` selects the database. Constraint names follow a naming convention (`app/db/base.py`) so migrations stay deterministic.
Review checklist for autogenerated files: functional indexes (e.g. `lower(email)`) are *not* detected, enum CHECKs can be emitted twice, and `JSONB` must be preserved.
CI runs `upgrade head`, `check`, `downgrade base` and the test-suite against real PostgreSQL 16.

## 7. Local development
```bash
docker compose -f infra/docker-compose.yml up -d db
cd backend && cp .env.example .env && alembic upgrade head
IF_TEST_DATABASE_URL=postgresql+psycopg://insightforge:insightforge@localhost:5432/insightforge pytest
```
Without `IF_TEST_DATABASE_URL`, tests run on in-memory SQLite (fast, but PostgreSQL-only behaviour such as JSONB is only exercised in CI).

## 8. Known limitations / future work
- Cross-table tenant consistency (e.g. an `insight` whose `workspace_id` differs from its version's) is enforced by the repositories, not by composite FKs. Consider composite FKs `(version_id, workspace_id)` or RLS.
- No transformation-history table yet (Phase 6) and no chat history (later).
- JSONB columns are intentionally unconstrained; their shapes are validated by Pydantic schemas in the engine, versioned via `profile_version`.
