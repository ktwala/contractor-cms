/**
 * hcm-bootstrap-decay.spec.ts
 * PR-GOV-SIGNAL-LIFECYCLE-3 — source-scan tests
 *
 * Verifies structural and doctrinal correctness across:
 *   - Schema: SignalLifecycleState enum and new fields
 *   - Audit catalog: BOOTSTRAP_SIGNAL_ARCHIVED
 *   - HcmBootstrapDecayService: exists, injects correctly, OPERATIONAL guard
 *   - HcmWorkforceCutoverService: calls decay after cutover write
 *   - Controller: bootstrap-decay/apply endpoint declared and guarded
 *   - DTOs: BootstrapDecaySummaryDto fields, ContractorSourceDriftItemDto new fields
 *   - Query layer: ARCHIVED exclusion in buildOperationalDriftVisibilityWhere
 *   - Frontend: DECAYING/ARCHIVED visual treatment in drift table
 */

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

const schema = read('backend/prisma/schema.prisma');
const auditConstants = read('backend/src/core/audit/audit-events.constants.ts');
const decayService = read(
  'backend/src/domain/contractor-sources/hcm-bootstrap-decay.service.ts',
);
const cutoverService = read(
  'backend/src/domain/contractor-sources/hcm-workforce-cutover.service.ts',
);
const controller = read(
  'backend/src/domain/contractor-sources/oracle-hcm-import.controller.ts',
);
const driftDto = read(
  'backend/src/domain/contractor-sources/dto/contractor-source-drift.dto.ts',
);
const lifecycleUtil = read(
  'backend/src/domain/contractor-sources/governance-signal-lifecycle.util.ts',
);
const panelSrc = (() => {
  const importDir = path.join(
    repoRoot,
    'frontend/components/contractor-sources/workforce-import',
  );
  const moduleSrc = fs
    .readdirSync(importDir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
    .map((file) => fs.readFileSync(path.join(importDir, file), 'utf8'))
    .join('\n');
  const opsPanelSrc = read('frontend/components/contractor-sources/HcmConnectorOperationsPanel.tsx');
  return `${opsPanelSrc}\n${moduleSrc}`;
})();

// ── Schema ────────────────────────────────────────────────────────────────────

describe('schema.prisma — SignalLifecycleState', () => {
  it('declares SignalLifecycleState enum', () => {
    expect(schema).toMatch(/enum SignalLifecycleState/);
  });

  it('enum contains ACTIVE, DECAYING, ARCHIVED', () => {
    expect(schema).toMatch(/SignalLifecycleState[\s\S]{0,200}ACTIVE/s);
    expect(schema).toMatch(/SignalLifecycleState[\s\S]{0,200}DECAYING/s);
    expect(schema).toMatch(/SignalLifecycleState[\s\S]{0,200}ARCHIVED/s);
  });

  it('ContractorSourceDrift has signalLifecycleState field', () => {
    expect(schema).toMatch(/signalLifecycleState\s+SignalLifecycleState/);
  });

  it('ContractorSourceDrift has decayStartedAt field', () => {
    expect(schema).toMatch(/decayStartedAt/);
  });

  it('ContractorSourceDrift has archivedAt field', () => {
    expect(schema).toMatch(/archivedAt/);
  });

  it('ContractorSourceDrift has archivedReason field', () => {
    expect(schema).toMatch(/archivedReason/);
  });

  it('ContractorSourceDrift has retentionUntil field', () => {
    expect(schema).toMatch(/retentionUntil/);
  });

  it('has composite index on signalCategory + signalLifecycleState', () => {
    expect(schema).toMatch(/signalCategory.*signalLifecycleState/s);
  });
});

// ── Audit catalog ─────────────────────────────────────────────────────────────

describe('audit-events.constants.ts — decay event', () => {
  it('registers BOOTSTRAP_SIGNAL_ARCHIVED', () => {
    expect(auditConstants).toMatch(/BOOTSTRAP_SIGNAL_ARCHIVED/);
  });

  it('BOOTSTRAP_SIGNAL_ARCHIVED has INFO severity', () => {
    expect(auditConstants).toMatch(/BOOTSTRAP_SIGNAL_ARCHIVED[\s\S]{0,100}INFO/s);
  });
});

// ── HcmBootstrapDecayService ──────────────────────────────────────────────────

describe('HcmBootstrapDecayService — structure and doctrine', () => {
  it('service file exists', () => {
    expect(decayService).toBeTruthy();
  });

  it('injects PrismaService', () => {
    expect(decayService).toMatch(/PrismaService/);
  });

  it('injects AuditService', () => {
    expect(decayService).toMatch(/AuditService/);
  });

  it('exports applyDecayForOrganization method', () => {
    expect(decayService).toMatch(/applyDecayForOrganization/);
  });

  it('WHERE clause targets BOOTSTRAP category — never OPERATIONAL', () => {
    // The update clauses must specify BOOTSTRAP; OPERATIONAL must not appear in update WHERE
    expect(decayService).toMatch(/GovernanceSignalCategory\.BOOTSTRAP/);
    // The word OPERATIONAL must NOT appear in an updateMany data/where context
    // (it may appear in comments or imports, but not in the update guard)
    const updateManyBlocks = decayService.match(/updateMany[\s\S]{0,400}/g) ?? [];
    for (const block of updateManyBlocks) {
      expect(block).not.toMatch(/OPERATIONAL/);
    }
  });

  it('guards on suppressAfterCutover=true for archive eligibility', () => {
    expect(decayService).toMatch(/suppressAfterCutover:\s*true/);
  });

  it('sets archivedReason to POST_CUTOVER_BOOTSTRAP_DECAY', () => {
    expect(decayService).toMatch(/POST_CUTOVER_BOOTSTRAP_DECAY/);
  });

  it('sets retentionUntil (7-year retention anchor)', () => {
    expect(decayService).toMatch(/retentionUntil/);
    expect(decayService).toMatch(/7/); // 7-year window
  });

  it('audit emission is non-blocking (void)', () => {
    expect(decayService).toMatch(/void this\.auditService\.logAction/);
  });

  it('emits BOOTSTRAP_SIGNAL_ARCHIVED audit event', () => {
    expect(decayService).toMatch(/BOOTSTRAP_SIGNAL_ARCHIVED/);
  });

  it('returns zero summary for NO_CUTOVER org', () => {
    expect(decayService).toMatch(/NO_CUTOVER/);
    expect(decayService).toMatch(/zeroSummary|activatedToDecaying: 0/);
  });

  it('grace period anchored on cutoverAt (not decayStartedAt)', () => {
    // computeDecayThreshold takes cutoverAt as input
    expect(decayService).toMatch(/computeDecayThreshold\(cutoverAt\)/);
  });
});

// ── HcmWorkforceCutoverService — decay integration ────────────────────────────

describe('HcmWorkforceCutoverService — calls decay after cutover write', () => {
  it('imports HcmBootstrapDecayService', () => {
    expect(cutoverService).toMatch(/HcmBootstrapDecayService/);
  });

  it('injects decayService in constructor', () => {
    expect(cutoverService).toMatch(/decayService.*HcmBootstrapDecayService/s);
  });

  it('calls applyDecayForOrganization after setCutover write', () => {
    expect(cutoverService).toMatch(/decayService\.applyDecayForOrganization/);
  });

  it('decay call is fire-and-forget (void)', () => {
    expect(cutoverService).toMatch(/void this\.decayService\.applyDecayForOrganization/);
  });
});

// ── Controller ────────────────────────────────────────────────────────────────

describe('controller — bootstrap-decay endpoint', () => {
  it("POST 'bootstrap-decay/apply' endpoint declared", () => {
    expect(controller).toMatch(/@Post\('bootstrap-decay\/apply'\)/);
  });

  it('endpoint requires workforce:cutover:manage', () => {
    // The decorator appears above the @Post decorator in the controller
    expect(controller).toMatch(/bootstrap-decay\/apply'\)/);
    expect(controller).toMatch(/PERMISSIONS\.WORKFORCE\.CUTOVER_MANAGE/);
  });

  it('controller injects HcmBootstrapDecayService', () => {
    expect(controller).toMatch(/HcmBootstrapDecayService/);
    expect(controller).toMatch(/decayService/);
  });

  it('returns BootstrapDecaySummaryDto', () => {
    expect(controller).toMatch(/BootstrapDecaySummaryDto/);
  });
});

// ── DTOs ─────────────────────────────────────────────────────────────────────

describe('contractor-source-drift.dto.ts — LIFECYCLE-3 additions', () => {
  it('BootstrapDecaySummaryDto declared', () => {
    expect(driftDto).toMatch(/BootstrapDecaySummaryDto/);
  });

  it('BootstrapDecaySummaryDto has activatedToDecaying', () => {
    expect(driftDto).toMatch(/activatedToDecaying/);
  });

  it('BootstrapDecaySummaryDto has decayingToArchived', () => {
    expect(driftDto).toMatch(/decayingToArchived/);
  });

  it('BootstrapDecaySummaryDto has decayThreshold', () => {
    expect(driftDto).toMatch(/decayThreshold/);
  });

  it('ContractorSourceDriftItemDto has signalLifecycleState', () => {
    expect(driftDto).toMatch(/signalLifecycleState/);
    expect(driftDto).toMatch(/SignalLifecycleState/);
  });

  it('ContractorSourceDriftItemDto has archivedAt + archivedReason + retentionUntil', () => {
    expect(driftDto).toMatch(/archivedAt/);
    expect(driftDto).toMatch(/archivedReason/);
    expect(driftDto).toMatch(/retentionUntil/);
  });
});

// ── Query layer ───────────────────────────────────────────────────────────────

describe('governance-signal-lifecycle.util.ts — ARCHIVED exclusion', () => {
  it('imports SignalLifecycleState', () => {
    expect(lifecycleUtil).toMatch(/SignalLifecycleState/);
  });

  it('buildOperationalDriftVisibilityWhere excludes ARCHIVED lifecycle state', () => {
    expect(lifecycleUtil).toMatch(/SignalLifecycleState\.ARCHIVED/);
    expect(lifecycleUtil).toMatch(/not.*ARCHIVED|ARCHIVED.*not/s);
  });

  it('OPERATIONAL signals have no lifecycle state restriction', () => {
    // The OPERATIONAL branch in the OR clause must not reference signalLifecycleState
    const operationalBranch = lifecycleUtil.match(
      /signalCategory: GovernanceSignalCategory\.OPERATIONAL[\s\S]{0,50}(?=\})/,
    )?.[0];
    expect(operationalBranch).toBeTruthy();
    expect(operationalBranch).not.toMatch(/signalLifecycleState/);
  });
});

// ── Frontend — drift table visual treatment ───────────────────────────────────

describe('HcmConnectorOperationsPanel — decay visual treatment', () => {
  it('reads signalLifecycleState from row', () => {
    expect(panelSrc).toMatch(/signalLifecycleState/);
  });

  it('renders archived-lineage-badge for ARCHIVED rows', () => {
    expect(panelSrc).toMatch(/archived-lineage-badge/);
    expect(panelSrc).toMatch(/Archived lineage/);
  });

  it('renders decaying-badge for DECAYING rows', () => {
    expect(panelSrc).toMatch(/decaying-badge/);
    expect(panelSrc).toMatch(/Decaying/);
  });

  it('ARCHIVED rows have de-emphasis styling', () => {
    expect(panelSrc).toMatch(/isArchived[\s\S]{0,100}opacity|opacity[\s\S]{0,100}isArchived/s);
  });

  it('DECAYING rows have distinct styling (amber)', () => {
    expect(panelSrc).toMatch(/isDecaying[\s\S]{0,100}amber|amber[\s\S]{0,100}isDecaying/s);
  });

  it('testid for archived bootstrap rows is drift-row-bootstrap-archived', () => {
    // The testid is built via a template literal:
    // `drift-row-bootstrap${isArchived ? '-archived' : ...}`
    expect(panelSrc).toMatch(/drift-row-bootstrap.*archived/s);
  });

  it('testid for decaying bootstrap rows is drift-row-bootstrap-decaying', () => {
    // The testid is built via a template literal:
    // `drift-row-bootstrap${... isDecaying ? '-decaying' : ''}`
    expect(panelSrc).toMatch(/drift-row-bootstrap.*decaying/s);
  });
});
