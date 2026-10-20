#!/usr/bin/env bash
# =============================================================================
# InsightForge AI - Production Database & Storage Backup Script
# Creates timestamped, gzip-compressed PostgreSQL dumps and archives storage files.
# =============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_BACKUP_FILE="${BACKUP_DIR}/insightforge_db_${TIMESTAMP}.sql.gz"
STORAGE_BACKUP_FILE="${BACKUP_DIR}/insightforge_storage_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "=========================================================="
echo " Starting InsightForge AI Backup: ${TIMESTAMP}"
echo "=========================================================="

# 1. PostgreSQL Database Dump
echo "--> Exporting PostgreSQL database..."
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-insightforge}" -d "${POSTGRES_DB:-insightforge}" | gzip > "$DB_BACKUP_FILE"

DB_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
echo "--> Database backup completed: ${DB_BACKUP_FILE} (${DB_SIZE})"

# 2. Archive Object Storage Volume
echo "--> Archiving object storage volume..."
docker run --rm \
    -v insightforge_storage_data:/source:ro \
    -v "$(pwd)/${BACKUP_DIR}":/backup \
    alpine tar -czf "/backup/insightforge_storage_${TIMESTAMP}.tar.gz" -C /source .

STORAGE_SIZE=$(du -h "$STORAGE_BACKUP_FILE" | cut -f1)
echo "--> Storage backup completed: ${STORAGE_BACKUP_FILE} (${STORAGE_SIZE})"

# 3. Retention Policy: Retain last 14 days of backups
echo "--> Pruning backups older than 14 days..."
find "$BACKUP_DIR" -type f -name "insightforge_*.gz" -mtime +14 -delete || true

echo "=========================================================="
echo " Backup Completed Successfully."
echo "=========================================================="
