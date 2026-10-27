#!/usr/bin/env bash
# =============================================================================
# KAIOAK TECH POS — PostgreSQL Backup Script
# =============================================================================
# เรียกใช้จาก cron หรือ CI/CD:
#   chmod +x scripts/backup_postgres.sh
#   0 3 * * * /opt/compos/scripts/backup_postgres.sh >> /var/log/compos_backup.log 2>&1
#
# ตัวแปรสภาพแวดล้อมที่ต้องมี (อ่านจาก .env หรือ shell environment):
#   PGHOST          — hostname ของ PostgreSQL (default: localhost)
#   PGPORT          — port (default: 5432)
#   PGDATABASE      — ชื่อฐานข้อมูล (default: compos_prod)
#   PGUSER          — username (default: compos_user)
#   PGPASSWORD      — password (ไม่ใช้ .pgpass เพื่อให้ใช้กับ Docker ได้)
#   BACKUP_DIR      — โฟลเดอร์สำรองข้อมูล (default: /opt/backup/dumps)
#   BACKUP_KEEP_DAYS— จำนวนวันที่เก็บ backup ไว้ (default: 30)
# =============================================================================

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-compos_prod}"
PGUSER="${PGUSER:-compos_user}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backup/dumps}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/compos_backup_${TIMESTAMP}.sql.gz"
LOG_PREFIX="[compos-backup][${TIMESTAMP}]"

# ─── Validate required env ────────────────────────────────────────────────────
if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "${LOG_PREFIX} ERROR: PGPASSWORD is not set. Aborting." >&2
  exit 1
fi

# ─── Ensure backup directory exists ──────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

echo "${LOG_PREFIX} Starting backup of ${PGDATABASE} → ${FILENAME}"

# ─── Run pg_dump ──────────────────────────────────────────────────────────────
# --no-acl / --no-owner: ไม่รวม GRANT และ ALTER OWNER ให้ restore ใส่ owner ใหม่ได้
# --compress=9: บีบอัดสูงสุด (ลดขนาดไฟล์)
PGPASSWORD="${PGPASSWORD}" pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --no-acl \
  --no-owner \
  --format=plain \
  "${PGDATABASE}" \
  | gzip -9 > "${FILENAME}"

BACKUP_SIZE=$(du -sh "${FILENAME}" | cut -f1)
echo "${LOG_PREFIX} Backup completed: ${FILENAME} (${BACKUP_SIZE})"

# ─── Verify file is not empty ─────────────────────────────────────────────────
if [[ ! -s "${FILENAME}" ]]; then
  echo "${LOG_PREFIX} ERROR: Backup file is empty. Database may be unreachable." >&2
  rm -f "${FILENAME}"
  exit 2
fi

# ─── Test integrity of compressed file ───────────────────────────────────────
if ! gzip -t "${FILENAME}" 2>/dev/null; then
  echo "${LOG_PREFIX} ERROR: Backup file is corrupt. Removing." >&2
  rm -f "${FILENAME}"
  exit 3
fi

# ─── Prune old backups ────────────────────────────────────────────────────────
DELETED=$(find "${BACKUP_DIR}" -type f -name "compos_backup_*.sql.gz" \
  -mtime "+${BACKUP_KEEP_DAYS}" -print -delete | wc -l)

echo "${LOG_PREFIX} Pruned ${DELETED} backup(s) older than ${BACKUP_KEEP_DAYS} days."
echo "${LOG_PREFIX} Done."
