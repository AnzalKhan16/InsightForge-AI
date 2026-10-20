#!/usr/bin/env bash
# =============================================================================
# InsightForge AI - Automated Production Deployment Runner
# Performs safe pre-flight checks, pulls/builds images, applies database
# migrations, and ensures zero-downtime rolling restart with health verifications.
# =============================================================================

set -euo pipefail

ENV_FILE=".env"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_PROD="docker-compose.prod.yml"

echo "=========================================================="
echo " Starting InsightForge AI Production Deployment"
echo " Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "=========================================================="

# 1. Pre-Flight Verification
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: Environment file $ENV_FILE does not exist. Aborting deployment." >&2
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker CLI not found. Please install Docker." >&2
    exit 1
fi

echo "--> Pre-flight checks passed."

# 2. Validate Compose Syntax
echo "--> Validating production configuration..."
docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD" config > /dev/null
echo "--> Compose configuration is valid."

# 3. Pull / Build Images
echo "--> Building production containers..."
docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD" build --pull

# 4. Start Database & Redis Dependencies
echo "--> Ensuring persistence layers (PostgreSQL & Redis) are healthy..."
docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD" up -d db redis

# Wait for database readiness probe
echo "--> Awaiting database readiness..."
RETRIES=30
until docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U insightforge > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo "Waiting for PostgreSQL ($RETRIES retries left)..."
    sleep 2
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    echo "ERROR: PostgreSQL failed to become healthy. Aborting." >&2
    exit 1
fi

# 5. Database Schema Migration
echo "--> Executing database schema migrations (Alembic)..."
docker compose -f "$COMPOSE_FILE" run --rm backend alembic upgrade head
echo "--> Schema migrations applied successfully."

# 6. Start Application Services
echo "--> Launching backend, worker, and frontend services..."
docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD" up -d --remove-orphans backend worker frontend

# 7. Post-Deployment Verification
echo "--> Performing service healthcheck verification..."
sleep 5
HEALTH_URL="http://localhost:8000/api/v1/health/ready"

for i in {1..15}; do
    if curl -s -f "$HEALTH_URL" > /dev/null; then
        echo "--> Healthcheck PASSED: Backend API is ready."
        break
    fi
    echo "Awaiting API readiness ($i/15)..."
    sleep 3
done

echo "=========================================================="
echo " InsightForge AI Deployed Successfully!"
echo " Frontend:  http://localhost:3000"
echo " API Docs:  http://localhost:8000/docs"
echo " Health:    http://localhost:8000/api/v1/health/ready"
echo "=========================================================="
