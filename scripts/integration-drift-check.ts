/**
 * PR-CMS-INT-3 — source adapter boundary drift checks.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const errors: string[] = [];

function read(rel: string): string {
  const full = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(full)) {
    errors.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function mustInclude(rel: string, pattern: RegExp, hint: string) {
  const content = read(rel);
  if (content && !pattern.test(content)) {
    errors.push(`${rel} — ${hint}`);
  }
}

function mustNotInclude(rel: string, pattern: RegExp, hint: string) {
  const content = read(rel);
  if (content && pattern.test(content)) {
    errors.push(`${rel} — ${hint}`);
  }
}

// Adapter contracts
mustInclude(
  'backend/src/integration/contracts/supplier-source.adapter.ts',
  /SupplierSourceAdapter/,
  'supplier source adapter interface required',
);
mustInclude(
  'backend/src/integration/contracts/contractor-source.adapter.ts',
  /ContractorSourceAdapter/,
  'contractor source adapter interface required',
);
mustInclude(
  'backend/src/integration/source-adapter.registry.ts',
  /SourceAdapterRegistry/,
  'tenant/source adapter registry required',
);

// Controllers use integration facade, not Oracle domain services
mustInclude(
  'backend/src/domain/supplier-sources/oracle-supplier-import.controller.ts',
  /SourceIntegrationService/,
  'Oracle supplier controller must use SourceIntegrationService',
);
mustNotInclude(
  'backend/src/domain/supplier-sources/oracle-supplier-import.controller.ts',
  /OracleSupplierImportService/,
  'Oracle supplier controller must not inject OracleSupplierImportService',
);
mustNotInclude(
  'backend/src/domain/supplier-sources/oracle-supplier-import.controller.ts',
  /SupplierGovernanceTwinPromotionService/,
  'Oracle supplier controller must not inject promotion service directly',
);

// HCM admin bootstrap routes through integration boundary
mustInclude(
  'backend/src/domain/contractor-migration/services/hcm-migration-admin.service.ts',
  /SourceIntegrationService/,
  'HCM migration admin must use SourceIntegrationService for ingest',
);
mustNotInclude(
  'backend/src/domain/contractor-migration/services/hcm-migration-admin.service.ts',
  /HcmContractorExtractAdapter/,
  'HCM migration admin must not inject extract adapter directly',
);

// Adapter implementation stays behind boundary
mustInclude(
  'backend/src/domain/supplier-sources/adapters/oracle-supplier-source.adapter.ts',
  /SupplierGovernanceTwinPromotionService/,
  'Oracle supplier adapter delegates promotion to governance twin service',
);
mustNotInclude(
  'backend/src/domain/supplier-sources/adapters/oracle-supplier-source.adapter.ts',
  /SupplierStatus\.ACTIVE/,
  'Oracle supplier adapter must not set supplier ACTIVE',
);
mustNotInclude(
  'backend/src/domain/supplier-sources/supplier-governance-twin-promotion.service.ts',
  /status:\s*SupplierStatus\.ACTIVE/,
  'governance twin promotion must not assign ACTIVE on create/link',
);
mustInclude(
  'backend/src/domain/suppliers/suppliers.controller.ts',
  /governance-dashboard/,
  'governance dashboard API required for ops visibility',
);

// PR-CMS-CONNECTOR-1A-C
mustInclude(
  'backend/src/integration/oracle-procurement/oracle-procurement-sync.service.ts',
  /SupplierSourceSyncRun/,
  'Oracle sync must use SupplierSourceSyncRun ledger',
);
mustInclude(
  'backend/src/domain/supplier-sources/supplier-staging-writer.service.ts',
  /supplierSourceStaging\.upsert/,
  'staging writer must upsert by external supplier id',
);
mustNotInclude(
  'backend/src/domain/supplier-sources/supplier-staging-writer.service.ts',
  /SupplierStatus\.ACTIVE/,
  'staging writer must not set supplier ACTIVE',
);
mustInclude(
  'backend/prisma/schema.prisma',
  /model SupplierSourceSyncRun/,
  'sync run model required',
);
mustNotInclude(
  'backend/src/domain/supplier-sources/oracle-supplier-import.controller.ts',
  /OracleSupplierImportService/,
  'controller must not inject OracleSupplierImportService directly',
);

// PR-CMS-CONNECTOR-1D–1E
mustInclude(
  'backend/src/domain/supplier-sources/oracle-supplier-import.controller.ts',
  /@Get\('health'\)/,
  'Oracle connector health GET endpoint required',
);
mustInclude(
  'backend/src/integration/oracle-procurement/oracle-procurement-health.service.ts',
  /evaluateOracleConnectorEffectiveHealth/,
  'stale detection must use effective health evaluation',
);
mustInclude(
  'backend/src/domain/supplier-sources/supplier-source-sync-run.service.ts',
  /advanceSuccessfulCheckpoint:\s*false/,
  'failed sync must not advance checkpoint',
);
mustInclude(
  'backend/src/integration/source-integration.service.ts',
  /getOracleConnectorHealth/,
  'integration facade must expose connector health',
);
mustNotInclude(
  'backend/src/domain/supplier-sources/supplier-staging-writer.service.ts',
  /SupplierStatus\.ACTIVE/,
  'staging writer must not set supplier ACTIVE on failure paths',
);

// PR-CMS-CONNECTOR-1F–1G
mustInclude(
  'backend/src/domain/supplier-sources/oracle-supplier-import.controller.ts',
  /@Get\('telemetry'\)/,
  'Oracle connector telemetry endpoint required',
);
mustInclude(
  'backend/src/domain/supplier-sources/oracle-supplier-import.controller.ts',
  /@Get\('dashboard'\)/,
  'Oracle connector operations dashboard endpoint required',
);
mustInclude(
  'backend/src/integration/source-integration.service.ts',
  /getOracleConnectorTelemetry/,
  'integration facade must expose connector telemetry',
);
mustInclude(
  'backend/src/domain/supplier-sources/oracle-connector-telemetry.service.ts',
  /supplierSourceSyncRun\.findMany/,
  'telemetry must derive from sync-run ledger',
);
mustInclude(
  'backend/src/domain/supplier-sources/oracle-connector-operations-dashboard.service.ts',
  /getHealthSnapshot/,
  'ops dashboard must use effective connector health',
);

// PR-CMS-CONNECTOR-4
mustInclude(
  'backend/prisma/schema.prisma',
  /model SupplierSourceDrift/,
  'SupplierSourceDrift registry required',
);
mustInclude(
  'backend/src/domain/supplier-sources/supplier-source-drift-detection.service.ts',
  /GOVERNANCE_STATE_CONFLICT/,
  'drift detection must classify governance conflicts',
);
mustInclude(
  'backend/src/domain/supplier-sources/oracle-supplier-import.controller.ts',
  /@Post\('drift\/detect'\)/,
  'manual drift detection endpoint required',
);
mustNotInclude(
  'backend/src/domain/supplier-sources/supplier-source-drift-detection.service.ts',
  /SupplierStatus\.ACTIVE/,
  'drift detection must not auto-set supplier ACTIVE',
);
mustNotInclude(
  'backend/src/domain/supplier-sources/supplier-source-drift.service.ts',
  /status:\s*SupplierStatus\.ACTIVE/,
  'drift workflow must not auto-remediate supplier ACTIVE',
);

// PR-CTR-CONNECTOR-1A–1C
mustInclude(
  'backend/prisma/schema.prisma',
  /model ContractorSourceSyncRun/,
  'HCM contractor sync run ledger required',
);
mustInclude(
  'backend/src/integration/oracle-hcm/oracle-hcm-rest.client.ts',
  /HttpOracleHcmRestClient/,
  'HCM REST client abstraction required',
);
mustInclude(
  'backend/src/domain/contractor-sources/hcm-contractor-connector-staging-writer.service.ts',
  /organizationId_sourceSystem_sourcePersonId/,
  'HCM connector staging must upsert by org + person id',
);
mustInclude(
  'backend/src/domain/contractor-sources/oracle-hcm-import.controller.ts',
  /contractor-sources\/oracle-hcm/,
  'HCM connector API surface required',
);
mustInclude(
  'backend/src/integration/source-integration.service.ts',
  /syncOracleHcmContractorsIncremental/,
  'integration facade must expose HCM sync',
);

// PR-CTR-CONNECTOR-1D
mustInclude(
  'backend/src/integration/oracle-hcm/oracle-hcm-health.util.ts',
  /evaluateHcmConnectorEffectiveHealth/,
  'HCM effective health evaluation required',
);
mustInclude(
  'backend/src/integration/oracle-hcm/oracle-hcm-health.service.ts',
  /recordSuccessfulRestSync/,
  'HCM health service must record REST-only success',
);
mustInclude(
  'backend/src/integration/oracle-hcm/oracle-hcm-sync.service.ts',
  /skipOrgConnectorUpdate/,
  'file replay must not update REST connector org state',
);
mustNotInclude(
  'backend/src/domain/contractor-sources/hcm-contractor-connector-staging-writer.service.ts',
  /promote|isActive:\s*true/,
  'HCM connector staging must not promote or activate contractors',
);
mustNotInclude(
  'backend/src/integration/oracle-hcm/oracle-hcm-sync.service.ts',
  /promoteHcm|PromoteHcm/,
  'HCM sync must not promote contractors',
);

// PR-CTR-CONNECTOR-1E
mustInclude(
  'backend/src/domain/contractor-sources/hcm-connector-telemetry.service.ts',
  /contractorSourceSyncRun\.findMany/,
  'HCM telemetry must derive from sync-run ledger',
);
mustInclude(
  'backend/src/domain/contractor-sources/oracle-hcm-import.controller.ts',
  /@Get\('telemetry'\)/,
  'HCM telemetry endpoint required',
);
mustInclude(
  'backend/src/domain/contractor-sources/oracle-hcm-import.controller.ts',
  /@Get\('dashboard'\)/,
  'HCM operations dashboard endpoint required',
);
mustInclude(
  'backend/src/integration/source-integration.service.ts',
  /getOracleHcmConnectorTelemetry/,
  'integration facade must expose HCM telemetry',
);
mustInclude(
  'frontend/app/contractor-sources/oracle-hcm/operations/page.tsx',
  /HcmConnectorOperationsPanel/,
  'workforce operations UI route required',
);

// PR-CTR-CONNECTOR-1F
mustInclude(
  'backend/prisma/schema.prisma',
  /model ContractorSourceDrift/,
  'ContractorSourceDrift registry required',
);
mustInclude(
  'backend/src/domain/contractor-sources/contractor-source-drift-detection.service.ts',
  /GOVERNANCE_LIFECYCLE_CONFLICT/,
  'workforce drift must detect lifecycle conflicts',
);
mustInclude(
  'backend/src/domain/contractor-sources/oracle-hcm-import.controller.ts',
  /@Post\('drift\/detect'\)/,
  'HCM drift detection endpoint required',
);
mustNotInclude(
  'backend/src/domain/contractor-sources/contractor-source-drift-detection.service.ts',
  /isActive:\s*false/,
  'drift detection must not auto-deactivate contractors',
);
mustNotInclude(
  'backend/src/domain/contractor-sources/contractor-source-drift.service.ts',
  /contractor\.update/,
  'drift workflow must not mutate contractor records',
);

// PR-CTR-CONNECTOR-1G
mustInclude(
  'backend/prisma/schema.prisma',
  /model ContractorGovernanceRemediation/,
  'ContractorGovernanceRemediation workflow required',
);
mustInclude(
  'backend/src/pdp/rules/workforce-governance.rule.ts',
  /WORKFORCE_GOVERNANCE_RESTRICTED/,
  'PDP cascade rule for workforce governance required',
);
mustInclude(
  'backend/src/domain/contractor-governance/contractor-governance-remediation.controller.ts',
  /@Controller\('contractor-governance\/remediation'\)/,
  'governance remediation API required',
);
mustNotInclude(
  'backend/src/domain/contractor-governance/contractor-governance-remediation.service.ts',
  /contractor\.update/,
  'remediation workflow must not auto-mutate contractor records',
);
mustNotInclude(
  'backend/src/domain/contractor-governance/contractor-governance-remediation-orchestrator.service.ts',
  /isActive:\s*false/,
  'remediation orchestrator must not auto-deactivate contractors',
);

if (errors.length > 0) {
  console.error('Integration drift check failed:\n');
  errors.forEach((e) => console.error(`  • ${e}`));
  process.exit(1);
}

console.log('✅ Integration drift check passed (PR-CMS-INT-3)');
