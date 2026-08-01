/**
 * hcm-migration-lineage.spec.ts
 * PR-CMS-LINEAGE-1 — "Show migration lineage" toggle correctness
 *
 * Source-scan tests: verify the component source carries all the required
 * structural and doctrinal properties without mocking React rendering.
 */

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function readWorkforceImportFrontend(): string {
  const panelSrc = read('frontend/components/contractor-sources/HcmConnectorOperationsPanel.tsx');
  const importDir = path.join(
    repoRoot,
    'frontend/components/contractor-sources/workforce-import',
  );
  const moduleSrc = fs
    .readdirSync(importDir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
    .map((file) => fs.readFileSync(path.join(importDir, file), 'utf8'))
    .join('\n');
  return `${panelSrc}\n${moduleSrc}`;
}

const panelSrc = readWorkforceImportFrontend();

describe('HcmConnectorOperationsPanel — migration lineage (source-scan)', () => {
  it('operationalOnly defaults to true (operational-only view on first load)', () => {
    // The initial useState call must use true as default
    expect(panelSrc).toMatch(/useState\(\s*true\s*\)/);
  });

  it('toggle label is "Show migration lineage" — no "HCM drift" framing', () => {
    expect(panelSrc).toMatch(/Show migration lineage/);
    expect(panelSrc).not.toMatch(/Show HCM drift/i);
    expect(panelSrc).not.toMatch(/show hcm drift/i);
  });

  it('passes operationalOnly state to listOracleHcmSourceDrift', () => {
    // Must pass the dynamic operationalOnly variable (not hardcoded true/false)
    expect(panelSrc).toMatch(/listOracleHcmSourceDrift\(\s*\{[^}]*operationalOnly/s);
  });

  it('operational rows are sorted before bootstrap rows', () => {
    // sortDriftRows function must exist and use signalCategory === BOOTSTRAP ordering
    expect(panelSrc).toMatch(/sortDriftRows/);
    expect(panelSrc).toMatch(/signalCategory.*BOOTSTRAP/s);
    // The sort must push bootstrap rows to the end (aIsBootstrap - bIsBootstrap)
    expect(panelSrc).toMatch(/aIsBootstrap\s*-\s*bIsBootstrap/);
  });

  it('bootstrap rows carry a "migration lineage" badge in the table', () => {
    expect(panelSrc).toMatch(/migration lineage/);
    expect(panelSrc).toMatch(/bootstrap-lineage-badge/);
    expect(panelSrc).toMatch(/drift-row-bootstrap/);
  });

  it('operational rows have their own testid', () => {
    expect(panelSrc).toMatch(/drift-row-operational/);
  });

  it('cutover banner is present in the JSX', () => {
    // The banner renders in three governance-phase variants:
    // NO_CUTOVER: Bootstrap lineage visible
    // PRE_CUTOVER: Pre-cutover
    // POST_CUTOVER: Post-cutover ... hidden by default
    expect(panelSrc).toMatch(/cutover-banner/);
    expect(panelSrc).toMatch(/Bootstrap lineage visible/);
    expect(panelSrc).toMatch(/bootstrap lineage hidden by default/);
  });

  it('workforceMigrationCutoverAt is consumed from dashboard payload', () => {
    expect(panelSrc).toMatch(/workforceMigrationCutoverAt/);
    expect(panelSrc).toMatch(/isPastCutover/);
  });

  it('does not contain HCM post-import authority wording', () => {
    // Must not claim HCM is authority after import
    expect(panelSrc).not.toMatch(/HCM post-import authority/i);
    // The original wording "HCM is not ongoing lifecycle authority after import" is acceptable
    // but "HCM owns lifecycle" or "HCM is authority" must NOT appear
    expect(panelSrc).not.toMatch(/HCM (is|owns|governs|remains) (the )?(ongoing|primary|lifecycle) (authority|governance)/i);
  });

  it('toggle testid is "migration-lineage-toggle"', () => {
    expect(panelSrc).toMatch(/data-testid="migration-lineage-toggle"/);
  });

  it('re-fetches drift rows on operationalOnly change without resetting all panels', () => {
    // Cutover tab lineage fetch must NOT call load() which resets everything
    expect(panelSrc).toMatch(/fetchLineageDrifts/);
    // operationalOnly must appear as a dependency in cutover tab lineage fetch
    expect(panelSrc).toMatch(/\[operationalOnly/);
  });
});

describe('backend DTO — workforceMigrationCutoverAt', () => {
  const dtoSrc = read(
    'backend/src/domain/contractor-sources/dto/hcm-connector-operations-dashboard.dto.ts',
  );
  const serviceSrc = read(
    'backend/src/domain/contractor-sources/hcm-connector-operations-dashboard.service.ts',
  );

  it('dashboard DTO declares workforceMigrationCutoverAt field', () => {
    expect(dtoSrc).toMatch(/workforceMigrationCutoverAt/);
  });

  it('dashboard service fetches and returns workforceMigrationCutoverAt', () => {
    expect(serviceSrc).toMatch(/workforceMigrationCutoverAt/);
    expect(serviceSrc).toMatch(/toISOString/);
  });

  it('service uses PrismaService to load the org cutover field', () => {
    expect(serviceSrc).toMatch(/PrismaService/);
    expect(serviceSrc).toMatch(/workforceMigrationCutoverAt.*true/s);
  });
});
