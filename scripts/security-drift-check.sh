#!/bin/bash

# Security Drift Gates
# This script ensures that the RBAC and API Contract security models do not regress.

echo "======================================"
echo "🛡️ Running Security Drift Gates..."
echo "======================================"

DRIFT_FOUND=0

# 1. Backend decorator drift gate
echo "Checking backend for query-based OrgContext scoping..."
if grep -rn "type: 'query'.*key: 'organizationId'" backend/src/domain backend/src/core; then
  echo "❌ DRIFT DETECTED: Backend controllers must use type: 'currentUser' for OrgContext. Query-based scoping is mathematically proven to be spoofable."
  DRIFT_FOUND=1
else
  echo "✅ Backend OrgContext is pristine."
fi

# 2. Frontend contract drift gate
echo "Checking frontend interceptors for organizationId injection..."
if grep -rn "organizationId\s*:" frontend/lib/api.ts | grep -v "//"; then
  echo "❌ DRIFT DETECTED: Frontend api.ts is attempting to inject 'organizationId'. The backend session AccessContext must remain the ultimate source of truth."
  DRIFT_FOUND=1
fi

if grep -rn "X-Organization-Id" frontend/lib/api.ts | grep -v "//"; then
  echo "❌ DRIFT DETECTED: Frontend api.ts is attempting to inject 'X-Organization-Id'. The backend session AccessContext must remain the ultimate source of truth."
  DRIFT_FOUND=1
fi

if grep -rn "axios\." frontend/app; then
  echo "❌ DRIFT DETECTED: Direct 'axios' usage found in frontend/app. All API calls must go through the shared api client in frontend/lib/api.ts to ensure contract governance."
  DRIFT_FOUND=1
else
  echo "✅ Frontend API Contract is pristine."
fi

# 3. Frontend Route Governance
echo "Checking frontend protected routes for missing pages..."
ROUTES=$(grep -oE "path:\s*'/[^']+'" frontend/lib/protected-routes.ts | awk -F"'" '{print $2}')
for route in $ROUTES; do
  if [ "$route" = "/" ]; then
    EXPECTED_FILE="frontend/app/page.tsx"
  else
    EXPECTED_FILE="frontend/app${route}/page.tsx"
  fi
  
  if [ ! -f "$EXPECTED_FILE" ]; then
    if [[ ! "$route" == *":"* ]]; then
      echo "❌ DRIFT DETECTED: Sidebar references route '$route' but '$EXPECTED_FILE' does not exist."
      DRIFT_FOUND=1
    fi
  fi
done

# 4. Permission Catalog Governance
echo "Checking permission catalog governance..."
if ! (cd backend && npx --yes ts-node ../scripts/permission-catalog-check.ts); then
  DRIFT_FOUND=1
fi

# 5. Audit Catalog Governance
echo "Checking audit catalog governance..."
if ! (cd backend && npx --yes ts-node ../scripts/audit-catalog-check.ts); then
  DRIFT_FOUND=1
fi

# 6. Governance Schema & PDP Regression
echo "Checking governance schema & PDP regression..."
if ! (cd backend && npx --yes ts-node ../scripts/governance-drift-check.ts); then
  DRIFT_FOUND=1
fi

# 7. EXTID substrate drift (PR-EXTID-SCHEMA-1D — G-EXTID-02, migration tracking, sponsor placement)
echo "Checking EXTID substrate drift (G-EXTID / migration SQL)..."
if ! (cd backend && npx --yes ts-node ../scripts/extid-drift-check.ts); then
  DRIFT_FOUND=1
fi

if [ $DRIFT_FOUND -eq 1 ]; then
  echo ""
  echo "🚨 SECURITY DRIFT CHECKS FAILED. Please fix the above errors before merging."
  exit 1
else
  echo ""
  echo "✅ ALL SECURITY DRIFT CHECKS PASSED. Platform governance is locked in."
  exit 0
fi
