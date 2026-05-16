#!/usr/bin/env bash
# Persona smoke — login as seeded users, probe /auth/profile + key APIs, print expected sidebar.
#
# Legacy demo users (same email, role bundle refreshed on reseed):
#   admin, finance, manager, contractor
# Target doctrine personas (PR-SEED-PERSONA-USERS-1):
#   supplier.admin, supplier.manager, sponsor
#
# Usage: API_BASE=http://localhost:3010/api/v1 ./scripts/smoke-role-personas.sh
# Prerequisite: cd backend && npm run db:seed

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3010/api/v1}"
RESPONSE_FILE="${TMPDIR:-/tmp}/role-smoke-response.json"

login() {
  local email="$1"
  local password="$2"

  curl -sS -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    | jq -r '.accessToken // .token // empty'
}

probe() {
  local token="$1"
  local method="$2"
  local path="$3"

  curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" \
    -X "$method" "$API_BASE$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json"
}

print_expected_sidebar() {
  local persona="$1"
  echo
  echo "Expected sidebar (after reseed — PR-NAV-IA-1):"
  case "$persona" in
    CONTRACTOR)
      cat <<'EOF'
  Operations:
    - Dashboard
    - Timesheets
  (no Invoices)
EOF
      ;;
    FINANCE_USER)
      cat <<'EOF'
  Operations:
    - Dashboard
    - Suppliers
    - Contractors
    - Timesheets
    - Invoices
  Governance:
    - Governance Activation
    - Governance Exceptions
EOF
      ;;
    CONTRACTOR_MANAGER)
      cat <<'EOF'
  Operations:
    - Dashboard
    - Suppliers
    - Contractors
    - Contracts
    - Engagements
    - Timesheets
  Governance:
    - Governance Activation
    - Governance Exceptions
  (no Invoices)
EOF
      ;;
    CMS_ADMIN)
      cat <<'EOF'
  Operations:
    - Dashboard
    - Suppliers
    - Contractors
    - Contracts
    - Engagements
    - Timesheets
    - Invoices
    - Projects
  Governance:
    - Governance Activation
    - Governance Exceptions
    - Audit Logs
    - Security Insights
  Administration:
    - Users
    - Roles
EOF
      ;;
    SUPPLIER_ADMIN)
      cat <<'EOF'
  Operations:
    - Dashboard
    - Supplier profile
    - Contractors
  (supplier-portal only — no client /suppliers, Contractors, Contracts, Invoices)
EOF
      ;;
    SUPPLIER_MANAGER)
      cat <<'EOF'
  Operations:
    - Dashboard
    - Supplier profile
    - Contractors
    - Supplier timesheets
  (supplier-portal only — no client /suppliers or /timesheets)
EOF
      ;;
    SPONSOR)
      cat <<'EOF'
  Operations:
    - Dashboard
    - Contractors
    - Engagements
  (no Suppliers, Contracts, Timesheets, Invoices, Governance, Administration)
EOF
      ;;
    *)
      echo "  (no template for $persona)"
      ;;
  esac
}

run_persona() {
  local role_key="$1"
  local display_name="$2"
  local email="$3"
  local password="$4"

  echo
  echo "========================================"
  echo "Persona: $display_name <$email>"
  echo "========================================"

  TOKEN="$(login "$email" "$password")"

  if [[ -z "$TOKEN" ]]; then
    echo "❌ Login failed"
    return 1
  fi

  echo "✅ Login OK"

  echo
  echo "Profile / effective permissions:"
  curl -sS "$API_BASE/auth/profile" \
    -H "Authorization: Bearer $TOKEN" \
    | jq '{
        email,
        roles: [.roles[]?.name],
        effectivePermissions: .effectivePermissions
      }'

  print_expected_sidebar "$role_key"

  echo
  echo "API surface checks (2xx = allowed, 403 = forbidden, 404 = missing route):"

  for item in \
    "GET /supplier-portal/profile" \
    "GET /supplier-portal/contractors" \
    "GET /supplier-portal/timesheets" \
    "GET /suppliers" \
    "GET /contractors" \
    "GET /contracts" \
    "GET /engagements" \
    "GET /timesheets" \
    "GET /invoices" \
    "GET /projects" \
    "GET /pdp/activation" \
    "GET /pdp/exceptions" \
    "GET /audit-logs" \
    "GET /settings/audit-insights"
  do
    method="$(echo "$item" | awk '{print $1}')"
    path="$(echo "$item" | awk '{print $2}')"
    code="$(probe "$TOKEN" "$method" "$path")"
    printf "  %-35s %s\n" "$item" "$code"
  done
}

echo "API_BASE=$API_BASE"
echo "Reseed first: cd backend && npm run db:seed"
echo

echo "── Legacy demo users (updated role bundles on same emails) ──"
run_persona "CMS_ADMIN" "CMS Admin" "admin@contractor-cms.com" "Admin123!"
run_persona "FINANCE_USER" "Finance User" "finance@contractor-cms.com" "Finance123!"
run_persona "CONTRACTOR_MANAGER" "Contractor Manager" "manager@contractor-cms.com" "Manager123!"
run_persona "CONTRACTOR" "Contractor" "contractor@contractor-cms.com" "Contractor123!"

echo
echo "── Target doctrine personas (PR-SEED-PERSONA-USERS-1) ──"
run_persona "SUPPLIER_ADMIN" "Supplier Admin" "supplier.admin@contractor-cms.com" "SupplierAdmin123!"
run_persona "SUPPLIER_MANAGER" "Supplier Manager" "supplier.manager@contractor-cms.com" "SupplierManager123!"
run_persona "SPONSOR" "Sponsor" "sponsor@contractor-cms.com" "Sponsor123!"

echo
echo "Done."
