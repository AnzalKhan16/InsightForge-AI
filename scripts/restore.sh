#!/usr/bin/env bash
# =============================================================================
# InsightForge AI - Production Disaster Recovery & Restore Script
# Restores a specified PostgreSQL SQL dump and storage archive into the system.
# =============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <path_to_db_dump.sql.gz> [path_to_storage.tar.gz]"
    echo "Example: $0 backups/insightforge_db_20261020_120000.sql.gz"
    exit 1
fi

DB_FILE="$1"
STORAGE_FILE="${2:-}"

if [ ! -f "$DB_FILE" ]; then
    echo "ERROR: Backup file $DB_FILE not found." >&2
    exit 1
fi

echo "=========================================================="
echo " WARNING: THIS WILL OVERWRITE THE CURRENT DATABASE!"
echo " Target Backup: $DB_FILE"
echo "=========================================================="
read -p "Are you sure you want to proceed with restore? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore aborted by user."
    exit 0
fi

# 1. Stop web application services
echo "--> Pausing application workers..."
docker compose stop backend worker frontend

# 2. Restore PostgreSQL Database
echo "--> Restoring PostgreSQL database from compressed dump..."
gunzip -c "$DB_FILE" | docker compose exec -T db psql -U "${POSTGRES_USER:-insightforge}" -d "${POSTGRES_DB:-insightforge}"

echo "--> Database restored successfully."

# 3. Restore Storage Archive (if provided)
if [ -n "$STORAGE_FILE" ] && [ -f "$STORAGE_FILE" ]; then
    echo "--> Restoring storage volume from $STORAGE_FILE..."
    docker run --rm \
        -v insightforge_storage_data:/target \
        -v "$(pwd)/$(dirname "$STORAGE_FILE")":/backup \
        alpine sh -c "rm -rf /target/* && tar -xzf /backup/$(basename "$STORAGE_FILE") -C /target"
    echo "--> Storage volume restored."
fi

# 4. Restart Services
echo "--> Restarting services..."
docker compose start backend worker frontend

echo "=========================================================="
echo " Restore Procedure Completed Successfully."
echo "=========================================================="
