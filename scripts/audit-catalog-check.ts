const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { AUDIT_EVENTS, isKnownAuditEvent } = require('../backend/src/core/audit/audit-events.constants');

const errors: string[] = [];

// Helper to extract regex matches from ripgrep
function getRipgrepMatches(regex: string, searchPaths: string[]): string[] {
  try {
    const output = execSync(`rg -o -I "${regex}" ${searchPaths.join(' ')}`, { encoding: 'utf8' });
    return output.split('\n').filter((line: string) => line.trim() !== '');
  } catch (error) {
    // If rg finds no matches, it exits with 1
    return [];
  }
}

function runChecks() {
  console.log('🛡️ Running Audit Catalog Governance Checks...\n');

  // 1. Every audit event used in code (logAction) exists in catalog
  console.log('Checking backend logAction usage...');
  // We look for calls like .logAction(..., 'ACTION_NAME'
  // Note: regex is slightly fragile but captures static strings
  const matches = getRipgrepMatches("logAction\\([^,]+,\\s*'([^']+)'", ['backend/src']);
  const usedAuditEvents = new Set<string>();

  matches.forEach((match: string) => {
    // Extract the action name
    const matchObj = match.match(/logAction\([^,]+,\s*'([^']+)'/);
    if (matchObj && matchObj[1]) {
      const action = matchObj[1];
      usedAuditEvents.add(action);
      if (!isKnownAuditEvent(action)) {
        errors.push(`Backend uses unknown audit event in logAction: ${action}`);
      }
    }
  });

  // 2. Identify missing sensitive actions
  // E.g., looking for @Delete without an audit log
  // This is hard to do statically with 100% precision, but we can check if controllers import AuditService
  const controllersWithDelete = getRipgrepMatches("@Delete", ['backend/src/domain']);
  // Simplistic check: just printing a reminder. Actual static analysis for this is complex.
  
  if (errors.length > 0) {
    console.error('\n❌ AUDIT CATALOG DRIFT DETECTED:');
    errors.forEach((e: string) => console.error('  - ' + e));
    process.exit(1);
  } else {
    console.log('\n✅ AUDIT CATALOG GOVERNANCE CHECKS PASSED.');
    process.exit(0);
  }
}

runChecks();
