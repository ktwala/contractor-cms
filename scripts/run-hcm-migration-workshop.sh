#!/usr/bin/env bash
# PR-CTR-3 — run HCM file extract workshop (ingest → validate → optional promote).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${FILE:-$ROOT/backend/test/fixtures/hcm-extract/workshop-sample.json}"
DOCKER_FILE="${DOCKER_FILE:-test/fixtures/hcm-extract/workshop-sample.json}"
ORG_CODE="${ORG_CODE:-DEMO}"
DRY_RUN="${DRY_RUN:-true}"
PROMOTE="${PROMOTE:-false}"
PUBLISH_IGA="${PUBLISH_IGA:-true}"
USE_DOCKER=false

ARGS=(--file "$FILE")
if [[ "$DRY_RUN" == "true" ]]; then
  ARGS+=(--dry-run)
fi
if [[ "$PROMOTE" == "true" ]]; then
  ARGS+=(--promote)
fi
if [[ "$PROMOTE" == "true" && "$PUBLISH_IGA" == "true" ]]; then
  ARGS+=(--publish-iga)
fi

echo "=== HCM migration workshop ==="
echo "  FILE=$FILE"
echo "  ORG_CODE=$ORG_CODE"
echo "  DRY_RUN=$DRY_RUN"
echo "  PROMOTE=$PROMOTE"
echo "  PUBLISH_IGA=$PUBLISH_IGA"
echo

if docker compose -f "$ROOT/docker-compose.yml" ps --status running 2>/dev/null | grep -q external-workforce-platform-backend; then
  USE_DOCKER=true
  ARGS=(--file "$DOCKER_FILE")
  if [[ "$DRY_RUN" == "true" ]]; then ARGS+=(--dry-run); fi
  if [[ "$PROMOTE" == "true" ]]; then ARGS+=(--promote); fi
  if [[ "$PROMOTE" == "true" && "$PUBLISH_IGA" == "true" ]]; then ARGS+=(--publish-iga); fi
  docker compose -f "$ROOT/docker-compose.yml" exec \
    -e ORG_CODE="$ORG_CODE" \
    backend npx ts-node -r tsconfig-paths/register scripts/hcm-migration-workshop.ts "${ARGS[@]}"
else
  cd "$ROOT/backend"
  ORG_CODE="$ORG_CODE" npx ts-node -r tsconfig-paths/register scripts/hcm-migration-workshop.ts "${ARGS[@]}"
fi
