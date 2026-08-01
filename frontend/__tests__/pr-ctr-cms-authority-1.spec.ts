/**
 * pr-ctr-cms-authority-1.spec.ts
 * PR-CTR-CMS-AUTHORITY-1 — source-scan tests
 *
 * Verifies structural and doctrinal correctness across:
 *   - Audit catalog registration of CONTRACTOR_CREATED_IN_CMS
 *   - CreateContractorDto addition of sponsorNote
 *   - Backend service: emits CONTRACTOR_CREATED_IN_CMS, excludes sponsorNote from DB create
 *   - Drift detection service: scans all active contractors for sponsor drift (inclusive of CMS-native)
 *   - Frontend app/contractors/page.tsx:
 *     - governance-aware banner
 *     - governance-aware empty states
 *     - classification/engagement/sponsorNote form fields
 *     - payload formatting (stripping status, mapping nationality -> taxResidency)
 *     - safe error catch on getWorkforceCutover()
 */

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

const auditConstants = read('backend/src/core/audit/audit-events.constants.ts');
const createDto = read('backend/src/domain/contractors/dto/create-contractor.dto.ts');
const contractorsService = read('backend/src/domain/contractors/contractors.service.ts');
const driftDetectionService = read(
  'backend/src/domain/contractor-sources/contractor-source-drift-detection.service.ts'
);
const contractorsPage = read('frontend/app/contractors/page.tsx');
const contractorFormModal = read('frontend/components/contractors/ContractorFormModal.tsx');

describe('PR-CTR-CMS-AUTHORITY-1 Audit Catalog Invariants', () => {
  it('registers CONTRACTOR_CREATED_IN_CMS in audit constants', () => {
    expect(auditConstants).toMatch(/CONTRACTOR_CREATED_IN_CMS/);
  });
});

describe('PR-CTR-CMS-AUTHORITY-1 DTO Invariants', () => {
  it('declares optional sponsorNote in CreateContractorDto', () => {
    expect(createDto).toMatch(/sponsorNote\??\s*:\s*string/);
    expect(createDto).toMatch(/@IsOptional\(\)/);
    expect(createDto).toMatch(/@IsString\(\)/);
  });
});

describe('PR-CTR-CMS-AUTHORITY-1 ContractorsService Invariants', () => {
  it('excludes sponsorNote from Prisma create input to prevent schema validation crashes', () => {
    expect(contractorsService).toMatch(/const\s+\{\s*sponsorNote\s*,\s*\.\.\.restDto\s*\}\s*=\s*createContractorDto/);
    expect(contractorsService).toMatch(/tx\.contractor\.create\(\{[\s\S]*\.\.\.restDto/);
  });

  it('logs CONTRACTOR_CREATED_IN_CMS audit event with missingResponsibleManagerAtCreation metadata', () => {
    expect(contractorsService).toMatch(/CONTRACTOR_CREATED_IN_CMS/);
    expect(contractorsService).toMatch(/missingResponsibleManagerAtCreation\s*:/);
    expect(contractorsService).toMatch(/sponsorNote\s*:\s*sponsorNote\s*\?\?\s*null/);
  });
});

describe('PR-CTR-CMS-AUTHORITY-1 Drift Detection Invariants', () => {
  it('queries all active contractors for unsponsored check (no legacySourceSystem filters)', () => {
    // Should search contractors without guarding only on ORACLE_HCM for unsponsored checks
    expect(driftDetectionService).toMatch(/unsponsoredContractors\s*=\s*await\s+this\.prisma\.contractor\.findMany\(\{[\s\S]*?none:\s*\{/);
    // Should fall back to CMS_NATIVE when legacySourceSystem is null
    expect(driftDetectionService).toMatch(/contractor\.legacySourceSystem\s*\?\?\s*MigrationSourceSystem\.CMS_NATIVE/);
  });
});

describe('PR-CTR-CMS-AUTHORITY-1 Frontend UI / Form Invariants', () => {
  it('safely catches errors when calling getWorkforceCutover() to avoid page crashes', () => {
    expect(contractorsPage).toMatch(/api\.getWorkforceCutover\(\)/);
    expect(contractorsPage).toMatch(/catch\s*\(\s*cutoverErr\s*\)\s*\{/);
    expect(contractorsPage).toMatch(/setGovernancePhase\(\s*['"]NO_CUTOVER['"]\s*\)/);
  });

  it('renders a color-coded governance context banner based on governancePhase', () => {
    expect(contractorsPage).toMatch(/data-testid="cutover-banner"/);
    expect(contractorsPage).toMatch(/governancePhase\s*===\s*['"]POST_CUTOVER['"]/);
    expect(contractorsPage).toMatch(/governancePhase\s*===\s*['"]PRE_CUTOVER['"]/);
  });

  it('renders governance-aware empty states based on cutover status', () => {
    expect(contractorsPage).toMatch(
      /governancePhase\s*===\s*['"]POST_CUTOVER['"]\s*\?[\s\S]*?EXTERNAL_WORKFORCE_LABELS\.addWorker[\s\S]*?:[\s\S]*?workforce import/,
    );
  });

  it('modal form contains classification, engagement model, and governance note fields', () => {
    expect(contractorFormModal).toMatch(/label="Worker classification"/);
    expect(contractorFormModal).toMatch(/label="Engagement model"/);
    expect(contractorFormModal).toMatch(/label="Governance note \(optional\)"/);
    expect(contractorFormModal).toMatch(/sponsorNote/);
  });

  it('maps form fields correctly to DTO requirements on creation and update', () => {
    const createPayloadBlock = contractorFormModal.match(
      /} else \{\s*const payload = \{([\s\S]*?)\};\s*const created = await api\.createContractor\(payload\)/,
    );
    expect(createPayloadBlock).toBeTruthy();
    expect(createPayloadBlock![1]).not.toContain('status:');
    expect(createPayloadBlock![1]).not.toContain('isActive:');
    // Maps nationality to taxResidency
    expect(contractorFormModal).toMatch(/taxResidency\s*:\s*formData\.nationality/);
    // Includes classification and engagement model
    expect(contractorFormModal).toMatch(/workerClassification\s*:\s*formData\.workerClassification/);
    expect(contractorFormModal).toMatch(/engagementModel\s*:\s*formData\.engagementModel/);
    // Update path includes isActive from status
    expect(contractorFormModal).toMatch(/isActive\s*:\s*formData\.status === 'ACTIVE'/);
  });
});
