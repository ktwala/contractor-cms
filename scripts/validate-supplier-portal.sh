#!/usr/bin/env bash
# PR-SUPPLIER-PORTAL-UX-1 validation — API-level browser-equivalent checks
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3010/api/v1}"
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
  curl -sS -o /tmp/portal-val-body.json -w "%{http_code}" \
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
    cat /tmp/portal-val-body.json 2>/dev/null | head -3
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Supplier portal validation (API_BASE=$API_BASE) ==="
echo

# --- SUPPLIER_ADMIN ---
echo "── supplier.admin@ (SUPPLIER_ADMIN) ──"
ADMIN_TOKEN=$(login "supplier.admin@contractor-cms.com" "SupplierAdmin123!")
[[ -n "$ADMIN_TOKEN" ]] || { echo "❌ Admin login failed"; exit 1; }
echo "  ✅ Login"

assert_code "GET /supplier-portal/profile" 200 "$(code "$ADMIN_TOKEN" GET /supplier-portal/profile)"
assert_code "PATCH /supplier-portal/profile (edit)" 200 "$(code "$ADMIN_TOKEN" PATCH /supplier-portal/profile -d '{"phone":"+27111111111"}')"
assert_code "GET /supplier-portal/contractors" 200 "$(code "$ADMIN_TOKEN" GET /supplier-portal/contractors)"
assert_code "GET /supplier-portal/resources (removed)" 404 "$(code "$ADMIN_TOKEN" GET /supplier-portal/resources)"
NOM_CODE=$(code "$ADMIN_TOKEN" POST /supplier-portal/contractors -d '{
  "firstName":"Validation",
  "lastName":"Contractor",
  "email":"validation.contractor@portal.test",
  "workerClassification":"INDEPENDENT_CONTRACTOR",
  "engagementModel":"DIRECT",
  "taxResidency":"ZA"
}')
assert_code "POST /supplier-portal/contractors (add)" "201" "$NOM_CODE"
assert_code "GET /supplier-portal/timesheets" 403 "$(code "$ADMIN_TOKEN" GET /supplier-portal/timesheets)"
assert_code "GET /suppliers (client)" 403 "$(code "$ADMIN_TOKEN" GET /suppliers)"
assert_code "GET /contractors (client)" 403 "$(code "$ADMIN_TOKEN" GET /contractors)"
assert_code "GET /invoices (client)" 403 "$(code "$ADMIN_TOKEN" GET /invoices)"
echo

# --- SUPPLIER_MANAGER ---
echo "── supplier.manager@ (SUPPLIER_MANAGER) ──"
MGR_TOKEN=$(login "supplier.manager@contractor-cms.com" "SupplierManager123!")
[[ -n "$MGR_TOKEN" ]] || { echo "❌ Manager login failed"; exit 1; }
echo "  ✅ Login"

assert_code "GET /supplier-portal/profile" 200 "$(code "$MGR_TOKEN" GET /supplier-portal/profile)"
assert_code "GET /supplier-portal/contractors" 200 "$(code "$MGR_TOKEN" GET /supplier-portal/contractors)"
assert_code "GET /supplier-portal/timesheets" 200 "$(code "$MGR_TOKEN" GET /supplier-portal/timesheets)"
assert_code "GET /supplier-portal/timesheets?status=SUBMITTED" 200 "$(code "$MGR_TOKEN" GET "/supplier-portal/timesheets?status=SUBMITTED")"
assert_code "GET /suppliers (client)" 403 "$(code "$MGR_TOKEN" GET /suppliers)"
assert_code "GET /contractors (client)" 403 "$(code "$MGR_TOKEN" GET /contractors)"
assert_code "GET /invoices (client)" 403 "$(code "$MGR_TOKEN" GET /invoices)"
echo

# --- Isolation: list only Demo Supplier ---
LIST=$(curl -sS "$API_BASE/supplier-portal/profile" -H "Authorization: Bearer $ADMIN_TOKEN")
NAME=$(echo "$LIST" | jq -r '.companyName // empty')
if [[ "$NAME" == "Demo Supplier Ltd" ]]; then
  echo "  ✅ Profile scoped to Demo Supplier Ltd"
  PASS=$((PASS + 1))
else
  echo "  ❌ Profile company unexpected: $NAME"
  FAIL=$((FAIL + 1))
fi

echo
echo "=== Summary: $PASS passed, $FAIL failed ==="
[[ "$FAIL" -eq 0 ]]
