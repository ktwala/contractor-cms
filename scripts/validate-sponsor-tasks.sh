#!/usr/bin/env bash
# PR-SPONSOR-TASKS-1 — sponsor task inbox smoke (requires db:seed + migration).
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api/v1}"

login() {
  curl -sS -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.accessToken // empty'
}

echo "=== Sponsor tasks validation (API_BASE=$API_BASE) ==="
if [[ "${SPONSOR_ACCOUNTABILITY_INBOX_ENABLED:-}" != "true" ]]; then
  echo "⏭️  Skipped — set SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true (backend + seed)"
  exit 0
fi
TOKEN=$(login "sponsor@ewp.demo" "Sponsor123!")
[[ -n "$TOKEN" ]] || { echo "❌ sponsor login failed"; exit 1; }
echo "  ✅ sponsor@ login"

TASKS=$(curl -sS "$API_BASE/sponsor-tasks?status=OPEN&limit=20" -H "Authorization: Bearer $TOKEN")
TOTAL=$(echo "$TASKS" | jq '.total')
echo "  Open tasks: $TOTAL"
if [[ "$TOTAL" -ge 1 ]]; then
  echo "  ✅ GET /sponsor-tasks returned open tasks"
else
  echo "  ❌ expected at least 1 open task (reseed + ensure sponsored engagement)"
  exit 1
fi

TASK_ID=$(echo "$TASKS" | jq -r '.data[0].id')
CERT_ID=$(echo "$TASKS" | jq -r '.data[] | select(.taskType=="CERTIFICATION_READINESS") | .id' | head -1)
if [[ -n "$CERT_ID" && "$CERT_ID" != "null" ]]; then
  curl -sS -X PATCH "$API_BASE/sponsor-tasks/${CERT_ID}/complete" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"notes":"validation script"}' | jq -e '.status == "COMPLETED"' >/dev/null
  echo "  ✅ PATCH complete certification task"
else
  echo "  ⚠ no CERTIFICATION_READINESS task to complete (skip)"
fi

echo "=== Done ==="
