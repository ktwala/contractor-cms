#!/usr/bin/env bash
# PR-DB-MIGRATION-REPAIR — recover P3009 failed migration state and re-apply idempotent DDL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILED_MIGRATION="20260517120000_supplier_membership"
USE_DOCKER=false

run_prisma() {
  if [[ "${USE_DOCKER}" == "true" ]]; then
    docker compose -f "$ROOT/docker-compose.yml" exec -T backend npx prisma "$@"
  else
    (cd "$ROOT/backend" && npx prisma "$@")
  fi
}

echo "=== PR-DB-MIGRATION-REPAIR ==="

if docker compose -f "$ROOT/docker-compose.yml" ps --status running 2>/dev/null | grep -q contractor-cms-backend; then
  USE_DOCKER=true
  echo "Using Docker backend service"
else
  echo "Using local backend directory"
fi

echo
echo "1) Inspecting failed migration row (if any)..."
if [[ "${USE_DOCKER}" == "true" ]]; then
  docker compose -f "$ROOT/docker-compose.yml" exec -T postgres psql -U contractor_cms -d contractor_cms -c \
    "SELECT migration_name, finished_at IS NOT NULL AS applied, rolled_back_at IS NOT NULL AS rolled_back FROM _prisma_migrations WHERE migration_name = '${FAILED_MIGRATION}';" || true
else
  echo "   (skipped — start postgres/docker for live inspection)"
fi

echo
echo "2) Marking failed migration as rolled back (when P3009 is present)..."
if run_prisma migrate resolve --rolled-back "${FAILED_MIGRATION}" 2>/dev/null; then
  echo "   Resolved: ${FAILED_MIGRATION} → rolled back"
else
  echo "   No rolled-back action needed (already applied or not failed)"
fi

echo
echo "3) Applying pending migrations (idempotent SQL)..."
run_prisma migrate deploy

echo
echo "4) Regenerating Prisma client..."
run_prisma generate

echo
echo "Done. Verify with: npx prisma migrate status"
