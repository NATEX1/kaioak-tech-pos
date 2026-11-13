#!/usr/bin/env bash
# =============================================================================
# KLYX LAB POS — PostgreSQL backup for Docker Compose
# =============================================================================
# Usage:
#   chmod +x scripts/backup_postgres_docker.sh
#   ./scripts/backup_postgres_docker.sh
#
# Cron example:
#   0 3 * * * /opt/compos/scripts/backup_postgres_docker.sh \
#     >> /opt/backup/logs/backup.log 2>&1
#
# Optional environment variables:
#   PROJECT_DIR       project directory (default: /opt/compos)
#   COMPOSE_FILE      compose file (default: docker-compose.prod.yml)
#   BACKUP_DIR        backup directory (default: /opt/backup/dumps)
#   BACKUP_KEEP_DAYS  retention in days (default: 30)
#   SERVICE           database service name (default: db)
# =============================================================================

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/compos}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backup/dumps}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
SERVICE="${SERVICE:-db}"

cd "${PROJECT_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/compos_backup_${TIMESTAMP}.sql.gz"
LOG_PREFIX="[compos-backup][${TIMESTAMP}]"

mkdir -p "${BACKUP_DIR}"

echo "${LOG_PREFIX} Starting backup of service '${SERVICE}'"

if ! docker compose -f "${COMPOSE_FILE}" ps --status running --services \
  | grep -qx "${SERVICE}"; then
  echo "${LOG_PREFIX} ERROR: service '${SERVICE}' is not running." >&2
  exit 1
fi

# Use the PostgreSQL container's own environment and pg_dump version.
if ! docker compose -f "${COMPOSE_FILE}" exec -T "${SERVICE}" sh -c \
  'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-acl --no-owner --format=plain' \
  | gzip -9 > "${FILENAME}"; then
  echo "${LOG_PREFIX} ERROR: pg_dump failed." >&2
  rm -f "${FILENAME}"
  exit 2
fi

if [[ ! -s "${FILENAME}" ]]; then
  echo "${LOG_PREFIX} ERROR: backup file is empty." >&2
  rm -f "${FILENAME}"
  exit 3
fi

if ! gzip -t "${FILENAME}" 2>/dev/null; then
  echo "${LOG_PREFIX} ERROR: backup file is corrupt." >&2
  rm -f "${FILENAME}"
  exit 4
fi

BACKUP_SIZE=$(du -sh "${FILENAME}" | cut -f1)
echo "${LOG_PREFIX} Backup completed: ${FILENAME} (${BACKUP_SIZE})"

DELETED=$(find "${BACKUP_DIR}" -type f -name "compos_backup_*.sql.gz" \
  -mtime "+${BACKUP_KEEP_DAYS}" -print -delete | wc -l | tr -d ' ')

echo "${LOG_PREFIX} Pruned ${DELETED} backup(s) older than ${BACKUP_KEEP_DAYS} days."
echo "${LOG_PREFIX} Done."
