#!/usr/bin/env bash
# =============================================================================
# InsightForge AI - Emergency Production Rollback Script
# Rolls back container deployments and optionally downgrades database schema migrations.
# =============================================================================

set -euo pipefail

TARGET_GIT_REF="${1:-HEAD~1}"

echo "=========================================================="
echo " InsightForge AI Emergency Rollback"
echo " Target Git Ref / Commit: ${TARGET_GIT_REF}"
echo "=========================================================="

read -p "Confirm rollback to ${TARGET_GIT_REF}? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback aborted."
    exit 0
fi

# 1. Rollback Database Migration (if required)
read -p "Do you need to downgrade the latest Alembic database migration? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "--> Downgrading last migration (alembic downgrade -1)..."
    docker compose run --rm backend alembic downgrade -1
    echo "--> Database migration downgraded."
fi

# 2. Checkout Target Commit
echo "--> Checking out target code ref: ${TARGET_GIT_REF}..."
git checkout "${TARGET_GIT_REF}"

# 3. Rebuild and Deploy Containers
echo "--> Rebuilding containers at target ref..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Healthcheck
echo "--> Verifying service health..."
sleep 5
curl -f http://localhost:8000/api/v1/health/ready || {
    echo "WARNING: Healthcheck did not pass immediately. Inspect logs via 'docker compose logs'."
}

echo "=========================================================="
echo " Rollback Executed Successfully."
echo "=========================================================="
