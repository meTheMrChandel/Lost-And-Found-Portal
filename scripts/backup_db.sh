#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# IIT Ropar Lost & Found Portal — Automated PostgreSQL Database Backup Script
# ─────────────────────────────────────────────────────────────────────────────

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups/database}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/lostandfound_backup_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="${DB_CONTAINER:-lostandfound_prod_db}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-lostandfound}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "${BACKUP_DIR}"

echo "==> Starting database backup for '${POSTGRES_DB}' at $(date)..."

# Dump and gzip directly from postgres container
docker exec -t "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "==> Backup completed successfully: ${BACKUP_FILE} (Size: ${BACKUP_SIZE})"

# Prune old backups older than RETENTION_DAYS
echo "==> Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "lostandfound_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;
echo "==> Done."
