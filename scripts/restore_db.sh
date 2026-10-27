#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# IIT Ropar Lost & Found Portal — Database Restore Script
# ─────────────────────────────────────────────────────────────────────────────

set -e

if [ -z "$1" ]; then
    echo "Usage: ./scripts/restore_db.sh <path_to_backup_file.sql or .sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="${DB_CONTAINER:-lostandfound_prod_db}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-lostandfound}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file '${BACKUP_FILE}' not found!"
    exit 1
fi

echo "==> WARNING: This will overwrite data in database '${POSTGRES_DB}'."
read -p "Are you sure you want to proceed? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "==> Restoring from ${BACKUP_FILE}..."

if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
else
    cat "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
fi

echo "==> Database restore completed successfully!"
