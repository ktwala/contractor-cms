/**
 * hcm-workforce-cutover.spec.ts
 * PR-GOV-SIGNAL-LIFECYCLE-2 — source-scan tests
 *
 * Verifies structural and doctrinal correctness across:
 *   - Audit catalog registration
 *   - Backend service (invariants + audit emission)
 *   - Controller (endpoints + permission guards)
 *   - Frontend API methods
 *   - WorkforceCutoverPanel component
 */

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

const auditConstants = read('backend/src/core/audit/audit-events.constants.ts');
const cutoverService = read(
  'backend/src/domain/contractor-sources/hcm-workforce-cutover.service.ts',
);
const controller = read(
  'backend/src/domain/contractor-sources/oracle-hcm-import.controller.ts',
);
const driftDto = read(
  'backend/src/domain/contractor-sources/dto/contractor-source-drift.dto.ts',
);
const apiTs = read('frontend/lib/api.ts');
const panelSrc = read(
  'frontend/components/contractor-sources/WorkforceCutoverPanel.tsx',
);
const opsPanelSrc = read(
  'frontend/components/contractor-sources/HcmConnectorOperationsPanel.tsx',
);
const cutoverTabSrc = read(
  'frontend/components/contractor-sources/workforce-import/WorkforceImportCutoverTab.tsx',
);
const workforceImportPanelSrc = `${opsPanelSrc}\n${cutoverTabSrc}`;

// ── Audit catalog ─────────────────────────────────────────────────────────────

describe('audit-events.constants.ts — cutover ceremony events', () => {
  it('registers WORKFORCE_CUTOVER_SET', () => {
    expect(auditConstants).toMatch(/WORKFORCE_CUTOVER_SET/);
  });

  it('registers WORKFORCE_CUTOVER_CLEARED', () => {
    expect(auditConstants).toMatch(/WORKFORCE_CUTOVER_CLEARED/);
  });

  it('both events have INFO severity', () => {
    // Both should appear near AUDIT_SEVERITY.INFO
    expect(auditConstants).toMatch(
      /WORKFORCE_CUTOVER_SET.*INFO/s,
    );
    expect(auditConstants).toMatch(
      /WORKFORCE_CUTOVER_CLEARED.*INFO/s,
    );
  });
});

// ── Backend service ───────────────────────────────────────────────────────────

describe('HcmWorkforceCutoverService — invariants + audit', () => {
  it('injects AuditService', () => {
    expect(cutoverService).toMatch(/AuditService/);
    expect(cutoverService).toMatch(/auditService/);
  });

  it('injects PrismaService', () => {
    expect(cutoverService).toMatch(/PrismaService/);
  });

  it('enforces invariant: no cutover before first successful import', () => {
    expect(cutoverService).toMatch(/oracleHcmLastSuccessfulSyncAt/);
    expect(cutoverService).toMatch(/Cannot declare workforce cutover before the first successful/);
  });

  it('enforces invariant: no cutover with zero materialized contractors', () => {
    expect(cutoverService).toMatch(/_count.*contractors/s);
    expect(cutoverService).toMatch(/Cannot declare workforce cutover with no materialized/);
  });

  it('emits WORKFORCE_CUTOVER_SET on set', () => {
    expect(cutoverService).toMatch(/WORKFORCE_CUTOVER_SET/);
    expect(cutoverService).toMatch(/logAction/);
  });

  it('emits WORKFORCE_CUTOVER_CLEARED on clear', () => {
    expect(cutoverService).toMatch(/WORKFORCE_CUTOVER_CLEARED/);
  });

  it('derives governancePhase: NO_CUTOVER / PRE_CUTOVER / POST_CUTOVER', () => {
    expect(cutoverService).toMatch(/NO_CUTOVER/);
    expect(cutoverService).toMatch(/PRE_CUTOVER/);
    expect(cutoverService).toMatch(/POST_CUTOVER/);
    expect(cutoverService).toMatch(/deriveGovernancePhase/);
  });

  it('audit emission is non-blocking (void)', () => {
    // Non-blocking — consistent with platform pattern
    expect(cutoverService).toMatch(/void this\.auditService\.logAction/);
  });
});

// ── DTOs ─────────────────────────────────────────────────────────────────────

describe('contractor-source-drift.dto.ts — cutover DTOs', () => {
  it('declares SetWorkforceCutoverDto', () => {
    expect(driftDto).toMatch(/SetWorkforceCutoverDto/);
  });

  it('declares WorkforceCutoverResponseDto', () => {
    expect(driftDto).toMatch(/WorkforceCutoverResponseDto/);
  });

  it('WorkforceCutoverResponseDto includes governancePhase field', () => {
    expect(driftDto).toMatch(/governancePhase/);
    expect(driftDto).toMatch(/NO_CUTOVER/);
    expect(driftDto).toMatch(/PRE_CUTOVER/);
    expect(driftDto).toMatch(/POST_CUTOVER/);
  });
});

// ── Controller ────────────────────────────────────────────────────────────────

describe('oracle-hcm-import.controller.ts — cutover endpoints', () => {
  it("GET 'cutover' endpoint declared", () => {
    expect(controller).toMatch(/@Get\('cutover'\)/);
  });

  it("POST 'cutover' endpoint declared", () => {
    expect(controller).toMatch(/@Post\('cutover'\)/);
  });

  it("POST 'cutover' requires workforce:cutover:manage", () => {
    expect(controller).toMatch(
      /PERMISSIONS\.WORKFORCE\.CUTOVER_MANAGE[\s\S]{0,200}cutover/,
    );
  });

  it('GET cutover requires contractor-migration:read', () => {
    // Both the read permission and the GET cutover endpoint must be present
    expect(controller).toMatch(/@Get\('cutover'\)/);
    expect(controller).toMatch(/contractor-migration:read/);
  });

  it('controller injects HcmWorkforceCutoverService', () => {
    expect(controller).toMatch(/HcmWorkforceCutoverService/);
    expect(controller).toMatch(/cutoverService/);
  });
});

// ── Frontend API ──────────────────────────────────────────────────────────────

describe('api.ts — cutover methods', () => {
  it('exports getWorkforceCutover method', () => {
    expect(apiTs).toMatch(/getWorkforceCutover/);
    expect(apiTs).toMatch(/\/contractor-sources\/oracle-hcm\/cutover/);
  });

  it('exports setWorkforceCutover method', () => {
    expect(apiTs).toMatch(/setWorkforceCutover/);
  });

  it('setWorkforceCutover accepts null (clear)', () => {
    expect(apiTs).toMatch(/setWorkforceCutover\s*\(\s*cutoverAt\s*:\s*string\s*\|\s*null\s*\)/);
  });

  it('both methods return governancePhase', () => {
    expect(apiTs).toMatch(/governancePhase.*NO_CUTOVER.*PRE_CUTOVER.*POST_CUTOVER/s);
  });
});

// ── WorkforceCutoverPanel ──────────────────────────────────────────────────────

describe('WorkforceCutoverPanel — structure and doctrine', () => {
  it('has cutover-panel testid', () => {
    expect(panelSrc).toMatch(/data-testid="cutover-panel"/);
  });

  it('has cutover-phase-badge testid', () => {
    expect(panelSrc).toMatch(/data-testid="cutover-phase-badge"/);
  });

  it('has cutover-date-input testid', () => {
    expect(panelSrc).toMatch(/data-testid="cutover-date-input"/);
  });

  it('has cutover-submit-btn testid', () => {
    expect(panelSrc).toMatch(/data-testid="cutover-submit-btn"/);
  });

  it('has cutover-clear-btn testid', () => {
    expect(panelSrc).toMatch(/data-testid="cutover-clear-btn"/);
  });

  it('has cutover-confirm-dialog testid', () => {
    expect(panelSrc).toMatch(/data-testid="cutover-confirm-dialog"/);
  });

  it('has cutover-error testid', () => {
    expect(panelSrc).toMatch(/data-testid="cutover-error"/);
  });

  it('uses "hidden by default" — not "resolved/gone/removed"', () => {
    expect(panelSrc).toMatch(/hidden by default/);
    expect(panelSrc).not.toMatch(/\blineage resolved\b/i);
    expect(panelSrc).not.toMatch(/\blineage gone\b/i);
    expect(panelSrc).not.toMatch(/\blineage removed\b/i);
    expect(panelSrc).not.toMatch(/\blineage cleared\b/i);
  });

  it('confirmation dialog copy references governance visibility, not deletion', () => {
    expect(panelSrc).toMatch(/reopens migration-era governance visibility/);
    expect(panelSrc).toMatch(/bootstrap lineage as the default visible/);
  });

  it('returns null when canManage=false (hidden for read-only users)', () => {
    expect(panelSrc).toMatch(/if\s*\(\s*!canManage\s*\)\s*return null/);
  });

  it('NO_CUTOVER banner text matches doctrine', () => {
    expect(panelSrc).toMatch(/Bootstrap lineage visible.*workforce cutover not declared/s);
  });

  it('PRE_CUTOVER banner text matches doctrine', () => {
    expect(panelSrc).toMatch(/Pre-cutover.*bootstrap governance remains active/s);
  });

  it('POST_CUTOVER banner text matches doctrine', () => {
    expect(panelSrc).toMatch(/Post-cutover.*operational governance prioritized/s);
  });

  it('calls setWorkforceCutover with null on clear', () => {
    expect(panelSrc).toMatch(/setWorkforceCutover\(null\)/);
  });
});

// ── HcmConnectorOperationsPanel integration ───────────────────────────────────

describe('HcmConnectorOperationsPanel — WorkforceCutoverPanel integration', () => {
  it('imports WorkforceCutoverPanel', () => {
    expect(workforceImportPanelSrc).toMatch(/WorkforceCutoverPanel/);
  });

  it('renders WorkforceCutoverPanel with canManage and onCutoverChanged', () => {
    expect(workforceImportPanelSrc).toMatch(/canManage=\{canCutover\}/);
    expect(opsPanelSrc).toMatch(/onCutoverChanged/);
  });

  it('NO_CUTOVER banner wording updated', () => {
    expect(cutoverTabSrc).toMatch(/Bootstrap lineage visible.*workforce cutover not declared/s);
  });

  it('POST_CUTOVER banner uses "hidden by default"', () => {
    expect(cutoverTabSrc).toMatch(/bootstrap lineage hidden by default/);
  });
});
