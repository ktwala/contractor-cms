#!/usr/bin/env bash
# PR-SPONSOR-SCOPE-VALIDATION-1 — prove sponsor row isolation (not just route 200).
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api/v1}"
PASS=0
FAIL=0

login() {
  curl -sS -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.accessToken // empty'
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✅ $label (=$actual)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label — expected $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Sponsor row-scope validation (API_BASE=$API_BASE) ==="
echo "Requires SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true on backend and reseed:"
echo "  SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true docker compose exec backend npm run db:seed"
echo

if [[ "${SPONSOR_ACCOUNTABILITY_INBOX_ENABLED:-}" != "true" ]]; then
  echo "⏭️  Skipped — set SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true (backend + seed)"
  exit 0
fi

SPONSOR_TOKEN=$(login "sponsor@ewp.demo" "Sponsor123!")
[[ -n "$SPONSOR_TOKEN" ]] || { echo "❌ sponsor login failed"; exit 1; }
echo "  ✅ sponsor@ login"

EXT_ID=$(curl -sS "$API_BASE/auth/profile" -H "Authorization: Bearer $SPONSOR_TOKEN" | jq -r '.externalId // empty')
assert_eq "profile.externalId" "ewp:emp:responsible-manager-demo" "$EXT_ID"

CONTRACTORS=$(curl -sS "$API_BASE/contractors?page=1&limit=50" -H "Authorization: Bearer $SPONSOR_TOKEN")
C_TOTAL=$(echo "$CONTRACTORS" | jq '.total')
C_EMAILS=$(echo "$CONTRACTORS" | jq -r '[.data[].email] | join(",")')

assert_eq "GET /contractors total" "1" "$C_TOTAL"
if echo "$C_EMAILS" | grep -q "seed-demo-contractor@demo.local"; then
  echo "  ✅ contractor list contains seed-demo-contractor@demo.local"
  PASS=$((PASS + 1))
else
  echo "  ❌ contractor list missing seed-demo-contractor@demo.local (got: $C_EMAILS)"
  FAIL=$((FAIL + 1))
fi

ENGAGEMENTS=$(curl -sS "$API_BASE/engagements?page=1&limit=50" -H "Authorization: Bearer $SPONSOR_TOKEN")
E_TOTAL=$(echo "$ENGAGEMENTS" | jq '.total')
E_SPONSOR=$(echo "$ENGAGEMENTS" | jq -r '.data[0].sponsorEmployeeId // empty')
E_CONTRACT=$(echo "$ENGAGEMENTS" | jq -r '.data[0].contract.contractNumber // empty')

assert_eq "GET /engagements total" "1" "$E_TOTAL"
assert_eq "engagement.sponsorEmployeeId" "ewp:emp:responsible-manager-demo" "$E_SPONSOR"
assert_eq "engagement.contractNumber" "DEMO-SEED-001" "$E_CONTRACT"

ADMIN_TOKEN=$(login "ops.admin@ewp.demo" "Admin123!")
ADMIN_BODY=$(curl -sS "$API_BASE/contractors?page=1&limit=50" -H "Authorization: Bearer $ADMIN_TOKEN")
ADMIN_TOTAL=$(echo "$ADMIN_BODY" | jq '.total')
ADMIN_EMAILS=$(echo "$ADMIN_BODY" | jq -r '[.data[].email] | join(",")')

if [[ "$ADMIN_TOTAL" -gt "$C_TOTAL" ]]; then
  echo "  ✅ admin sees more contractors ($ADMIN_TOTAL) than sponsor ($C_TOTAL) — no org-wide leakage"
  PASS=$((PASS + 1))
else
  echo "  ❌ admin total ($ADMIN_TOTAL) should exceed sponsor ($C_TOTAL); reseed for unsponsored demo rows"
  FAIL=$((FAIL + 1))
fi

if echo "$ADMIN_EMAILS" | grep -q "seed-unsponsored-a@demo.local"; then
  echo "  ✅ admin list includes unsponsored seed contractor (org-wide registry)"
  PASS=$((PASS + 1))
else
  echo "  ❌ admin missing seed-unsponsored-a@demo.local (got: $ADMIN_EMAILS) — run db:seed"
  FAIL=$((FAIL + 1))
fi

if echo "$C_EMAILS" | grep -q "seed-unsponsored"; then
  echo "  ❌ sponsor leaked unsponsored contractor emails: $C_EMAILS"
  FAIL=$((FAIL + 1))
else
  echo "  ✅ sponsor list excludes unsponsored demo contractors"
  PASS=$((PASS + 1))
fi

echo
echo "=== Summary: $PASS passed, $FAIL failed ==="
[[ "$FAIL" -eq 0 ]]
