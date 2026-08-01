#!/usr/bin/env bash
# PR-WORKFORCE-E2E-UAT-1 — supplier-backed workforce administration proof (API-level)
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api/v1}"
RUN_ID="${RUN_ID:-$(date +%s)}"
PASS=0
FAIL=0

login() {
  curl -sS -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.accessToken // empty'
}

code() {
  local token="$1" method="$2" path="$3"
  shift 3
  curl -sS -o /tmp/workforce-uat-body.json -w "%{http_code}" \
    -X "$method" "$API_BASE$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    "$@"
}

assert_code() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✅ $label → $actual"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label → expected $expected, got $actual"
    head -3 /tmp/workforce-uat-body.json 2>/dev/null || true
    FAIL=$((FAIL + 1))
  fi
}

assert_timeline_step() {
  local label="$1" index="$2" from="$3" to="$4" source="$5"
  local actual_from actual_to actual_source
  actual_from=$(jq -r ".data[$index].fromState // \"null\"" /tmp/workforce-uat-body.json)
  actual_to=$(jq -r ".data[$index].toState // empty" /tmp/workforce-uat-body.json)
  actual_source=$(jq -r ".data[$index].source // empty" /tmp/workforce-uat-body.json)

  if [[ "$actual_from" == "$from" && "$actual_to" == "$to" && "$actual_source" == "$source" ]]; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label → got ${actual_from:-∅}→${actual_to:-∅} (${actual_source:-∅})"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Workforce Administration UAT (PR-WORKFORCE-E2E-UAT-1) ==="
echo "API_BASE=$API_BASE"
echo

echo "── Prerequisites: demo supplier + contract (seed) ──"
SUPPLIER_TOKEN=$(login "supplier.admin@ewp.demo" "SupplierAdmin123!")
OPS_TOKEN=$(login "ops.admin@ewp.demo" "Admin123!")
[[ -n "$SUPPLIER_TOKEN" ]] || { echo "❌ Supplier login failed"; exit 1; }
[[ -n "$OPS_TOKEN" ]] || { echo "❌ Ops login failed"; exit 1; }
echo "  ✅ Supplier + ops login"

CONTRACT_ID=$(curl -sS "$API_BASE/supplier-portal/contracts" \
  -H "Authorization: Bearer $SUPPLIER_TOKEN" | jq -r '.data[0].id // empty')
if [[ -z "$CONTRACT_ID" ]]; then
  echo "  ❌ No active supplier contract — run prisma seed"
  exit 1
fi
echo "  ✅ Active supplier contract available"

echo
echo "── 1. Supplier nominates contractor ──"
NOM_EMAIL="workforce.uat.${RUN_ID}@portal.test"
NOM_CODE=$(code "$SUPPLIER_TOKEN" POST /supplier-portal/contractors -d "{
  \"firstName\":\"Workforce\",
  \"lastName\":\"UAT\",
  \"email\":\"${NOM_EMAIL}\",
  \"workerClassification\":\"INDEPENDENT_CONTRACTOR\",
  \"engagementModel\":\"DIRECT\",
  \"taxResidency\":\"ZA\",
  \"nominationReason\":\"Workforce UAT nomination\",
  \"engagement\":{
    \"contractId\":\"${CONTRACT_ID}\",
    \"role\":\"UAT Developer\",
    \"startDate\":\"2026-06-01\",
    \"rateType\":\"HOURLY\",
    \"rateAmount\":750
  }
}")
assert_code "POST /supplier-portal/contractors" "201" "$NOM_CODE"

CONTRACTOR_ID=$(jq -r '.id // empty' /tmp/workforce-uat-body.json)
WF_STATE=$(jq -r '.workforceState // empty' /tmp/workforce-uat-body.json)
if [[ "$WF_STATE" == "NOMINATED" && -n "$CONTRACTOR_ID" ]]; then
  echo "  ✅ Nominated at NOMINATED"
  PASS=$((PASS + 1))
else
  echo "  ❌ Expected NOMINATED contractor id, got state=$WF_STATE id=$CONTRACTOR_ID"
  FAIL=$((FAIL + 1))
fi

echo
echo "── 2. Supplier sees null → NOMINATED timeline ──"
assert_code "GET supplier workforce-history" 200 \
  "$(code "$SUPPLIER_TOKEN" GET "/supplier-portal/contractors/${CONTRACTOR_ID}/workforce-history")"
assert_timeline_step "Supplier timeline step 0" 0 "null" "NOMINATED" "SUPPLIER_PORTAL"

echo
echo "── 3. Ops sees nomination in review queue ──"
QUEUE_CODE=$(code "$OPS_TOKEN" GET /contractors/workforce-review)
assert_code "GET /contractors/workforce-review" 200 "$QUEUE_CODE"
if jq -e --arg id "$CONTRACTOR_ID" '.data[] | select(.id==$id and .workforceState=="NOMINATED")' /tmp/workforce-uat-body.json >/dev/null; then
  echo "  ✅ Contractor visible in ops review queue"
  PASS=$((PASS + 1))
else
  echo "  ❌ Contractor not found in review queue"
  FAIL=$((FAIL + 1))
fi

echo
echo "── 4. Ops submits for review (NOMINATED → PENDING_APPROVAL) ──"
assert_code "PATCH workforce-transition → PENDING_APPROVAL" 200 \
  "$(code "$OPS_TOKEN" PATCH "/contractors/${CONTRACTOR_ID}/workforce-transition" -d '{
    "targetState":"PENDING_APPROVAL",
    "reason":"Ops review — not MTN approval workflow"
  }')"

echo
echo "── 5. Ops activates (PENDING_APPROVAL → ACTIVE) ──"
assert_code "PATCH workforce-transition → ACTIVE" 200 \
  "$(code "$OPS_TOKEN" PATCH "/contractors/${CONTRACTOR_ID}/workforce-transition" -d '{
    "targetState":"ACTIVE",
    "reason":"Ops activation — workforce plane only"
  }')"

echo
echo "── 6. Registry shows ACTIVE ──"
assert_code "GET /contractors/:id" 200 \
  "$(code "$OPS_TOKEN" GET "/contractors/${CONTRACTOR_ID}")"
REGISTRY_STATE=$(jq -r '.workforceState // empty' /tmp/workforce-uat-body.json)
REGISTRY_ACTIVE=$(jq -r '.isActive // empty' /tmp/workforce-uat-body.json)
if [[ "$REGISTRY_STATE" == "ACTIVE" && "$REGISTRY_ACTIVE" == "true" ]]; then
  echo "  ✅ Registry workforceState=ACTIVE, isActive=true"
  PASS=$((PASS + 1))
else
  echo "  ❌ Registry state mismatch: workforceState=$REGISTRY_STATE isActive=$REGISTRY_ACTIVE"
  FAIL=$((FAIL + 1))
fi

echo
echo "── 7. Supplier sees full timeline ──"
assert_code "GET supplier workforce-history (final)" 200 \
  "$(code "$SUPPLIER_TOKEN" GET "/supplier-portal/contractors/${CONTRACTOR_ID}/workforce-history")"
assert_timeline_step "Supplier timeline step 0" 0 "null" "NOMINATED" "SUPPLIER_PORTAL"
assert_timeline_step "Supplier timeline step 1" 1 "NOMINATED" "PENDING_APPROVAL" "OPS"
assert_timeline_step "Supplier timeline step 2" 2 "PENDING_APPROVAL" "ACTIVE" "OPS"

echo
echo "── 8. Supplier cannot advance workforce state ──"
assert_code "Supplier PATCH workforce-transition forbidden" 403 \
  "$(code "$SUPPLIER_TOKEN" PATCH "/contractors/${CONTRACTOR_ID}/workforce-transition" -d '{"targetState":"SUSPENDED"}')"

echo
echo "── Summary ──"
echo "Passed: $PASS"
echo "Failed: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
echo "Workforce Administration UAT proof complete."
