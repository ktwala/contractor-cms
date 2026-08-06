#!/bin/sh
set -e

echo "=== external-workforce-platform backend startup ==="

echo "Applying database migrations..."
if ! npx prisma migrate deploy; then
  echo "migrate deploy failed — falling back to db push (dev only)"
  npx prisma db push --accept-data-loss
fi

npx prisma generate

echo "Ensuring demo seed data (idempotent)..."
npx prisma db seed

# PR-DEMO-CONNECTOR-1 — greenfield connector baseline (default MTN sales path).
# Hidden comparison anchors are opt-in via SEED_HCM_COMPARISON_ANCHORS=true (migration/conflict UAT).
if [ "${DEMO_MODE:-true}" = "true" ]; then
  echo "Resetting connector demo baseline (greenfield — no pre-seeded workers)..."
  npm run reset:connector-demo 2>/dev/null \
    || npm run seed:connector-demo \
    || npx ts-node scripts/seed-connector-demo.ts \
    || echo "WARN: connector demo reset failed — run: docker compose exec backend npx ts-node scripts/seed-connector-demo.ts"
fi

echo "Starting API..."
exec "$@"
