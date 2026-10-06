# Development Conventions

## Repository layout
```
backend/            FastAPI app (Python 3.11)
  app/api/v1/       HTTP layer only: routing, request/response schemas
  app/core/         config, errors, shared infrastructure
  app/engine/       data / analytics / ml  (pure Python, no FastAPI/DB/LLM imports)
  tests/
frontend/           Next.js (App Router) + TypeScript + Tailwind
  src/lib/api.ts    the ONLY place that talks to the backend
docs/               architecture + conventions
infra/              docker-compose, deployment config
.github/workflows/  CI
```

## Layering rules
- `api` -> (later `services`) -> `engine`. Never the reverse; `engine` has no knowledge of HTTP, DB or LLMs.
- The frontend is presentation only. It never touches the DB or object storage; everything goes through `/api/v1`.
- The LLM layer (future) receives only structured outputs of `engine`, never raw rows (see architecture.md).

## API versioning
- All routes are under `/api/v1`. Breaking changes require a new `/api/v2` router; v1 stays until deprecated.
- OpenAPI schema: `/api/v1/openapi.json`, docs UI: `/docs`.

## Error convention
All errors use one envelope (see `backend/app/core/errors.py`):
```json
{"error": {"code": "not_found", "message": "...", "details": null, "request_id": "..."}}
```
- Raise `AppError` subclasses for expected failures; unhandled exceptions become `internal_error` (500) with no internals leaked.
- Every response carries `X-Request-ID` (echoed from the request or generated).
- The frontend maps these to `ApiError` in `src/lib/api.ts`.

## Environment configuration
- Backend: env vars prefixed `IF_`, loaded by `app/core/config.py` (typed, validated). Local: copy `backend/.env.example` to `.env`.
- Frontend: `NEXT_PUBLIC_API_BASE_URL` (public values only, never secrets). Local: `frontend/.env.local`.
- `.env` files are git-ignored; only `.env.example` is committed. Production values live in Vercel/Render settings.

## Code style
- Python: `ruff` (lint + import sort), type hints, Pydantic models for I/O, `pytest`.
- TypeScript: `strict` mode, `tsc --noEmit` as lint, functional components.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Branches: `main` is always deployable; work on feature branches via PR; CI must pass.

## Running locally
```bash
# backend
cd backend && python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && npm install && cp .env.example .env.local && npm run dev
```
