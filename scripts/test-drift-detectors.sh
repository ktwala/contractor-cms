#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=================================================="
echo "🧪 Running Drift Detector Verification Suite..."
echo "=================================================="

# Create backups
cp frontend/lib/api.ts frontend/lib/api.ts.orig
cp backend/prisma/schema.prisma backend/prisma/schema.prisma.orig

# Function to restore modified files
cleanup() {
  echo "🧹 Cleaning up temporary modifications..."
  if [ -f frontend/lib/api.ts.orig ]; then
    mv frontend/lib/api.ts.orig frontend/lib/api.ts
  fi
  if [ -f backend/prisma/schema.prisma.orig ]; then
    mv backend/prisma/schema.prisma.orig backend/prisma/schema.prisma
  fi
}
trap cleanup EXIT

# 1. Verify current repository passes
echo -n "Test 1: Clean repository passes check... "
if bash scripts/security-drift-check.sh >/dev/null 2>&1; then
  echo "✅ PASSED"
else
  echo "❌ FAILED"
  exit 1
fi

# 2. Test: Typed organizationId property passes
echo -n "Test 2: Typed organizationId property passes check... "
perl -pi -e 's/async getSupplierGovernanceDashboard/safeTypedProp?: { organizationId: string };\n  async getSupplierGovernanceDashboard/' frontend/lib/api.ts
if bash scripts/security-drift-check.sh >/dev/null 2>&1; then
  echo "✅ PASSED"
else
  echo "❌ FAILED"
  exit 1
fi
# Restore state for next test
cp frontend/lib/api.ts.orig frontend/lib/api.ts

# 3. Test: Safe request-body type declaration passes
echo -n "Test 3: Safe request-body type declaration passes check... "
perl -pi -e 's/async getSupplierGovernanceDashboard/interface UpdateOrgBody { orgContext: { organizationId: string; }; }\n  async getSupplierGovernanceDashboard/' frontend/lib/api.ts
if bash scripts/security-drift-check.sh >/dev/null 2>&1; then
  echo "✅ PASSED"
else
  echo "❌ FAILED"
  exit 1
fi
# Restore state for next test
cp frontend/lib/api.ts.orig frontend/lib/api.ts

# 4. Test: Query-string injection using organizationId fails
echo -n "Test 4: Unsafe query-parameter injection fails check... "
perl -pi -e 's/async getSupplierGovernanceDashboard/const url = "\/suppliers\/governance-dashboard?organizationId=" + orgId;\n  async getSupplierGovernanceDashboard/' frontend/lib/api.ts
if ! bash scripts/security-drift-check.sh >/dev/null 2>&1; then
  echo "✅ PASSED (caught query injection)"
else
  echo "❌ FAILED (did not catch query injection)"
  exit 1
fi
# Restore state for next test
cp frontend/lib/api.ts.orig frontend/lib/api.ts

# 5. Test: Removing required responsible-manager schema fields fails
echo -n "Test 5: Removing responsibleManagerEmployeeId from ContractorEngagement fails check... "
perl -pi -e 's/responsibleManagerEmployeeId.*/\/\//' backend/prisma/schema.prisma
if ! bash scripts/security-drift-check.sh >/dev/null 2>&1; then
  echo "✅ PASSED (caught missing responsibleManager field)"
else
  echo "❌ FAILED (did not catch missing responsibleManager field)"
  exit 1
fi
# Restore state
cp backend/prisma/schema.prisma.orig backend/prisma/schema.prisma

echo "=================================================="
echo "🎉 ALL DRIFT DETECTOR TESTS PASSED SUCCESSFULLY!"
echo "=================================================="
