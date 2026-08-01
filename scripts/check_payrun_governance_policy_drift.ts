/**
 * PR-PAYRUN-GOV-6A / GOV-6B / GOV-6C / GOV-7A — governance policy registry + enforcement + admin UI + impact preview drift (CI).
 * Run: npm run check:payrun-governance-policy-drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '..');

function fail(msg: string): never {
  console.error(`[check:payrun-governance-policy-drift] FAIL: ${msg}`);
  process.exit(1);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function main(): void {
  const schema = read(path.join(REPO, 'prisma/schema.prisma'));
  const mig = read(
    path.join(REPO, 'prisma/migrations/20260513140000_payroll_governance_policy_registry/migration.sql'),
  );
  const svc = read(path.join(REPO, 'src/modules/payroll-cycle/services/payroll-governance-policy.service.ts'));
  const ctrl = read(path.join(REPO, 'src/modules/payroll-cycle/payroll-cycle.controller.ts'));
  const mod = read(path.join(REPO, 'src/modules/payroll-cycle/payroll-cycle.module.ts'));
  const dto = read(path.join(REPO, 'src/modules/payroll-cycle/dto/governance-policy.dto.ts'));
  const spec = read(path.join(REPO, 'src/modules/payroll-cycle/__tests__/payroll-governance-policy.service.spec.ts'));
  const valSpec = read(path.join(REPO, 'src/modules/payroll-cycle/__tests__/governance-policy-value.validator.spec.ts'));
  const valSrc = read(path.join(REPO, 'src/modules/payroll-cycle/services/governance-policy-value.validator.ts'));
  const hashSrc = read(path.join(REPO, 'src/modules/payroll-cycle/services/governance-policy-payload-hash.ts'));
  const impactDto = read(path.join(REPO, 'src/modules/payroll-cycle/dto/governance-policy-impact.dto.ts'));
  const hashSpec = read(path.join(REPO, 'src/modules/payroll-cycle/__tests__/governance-policy-payload-hash.spec.ts'));
  const govUi = read(path.join(REPO, 'admin-portal/src/pages/GovernancePolicies.tsx'));
  const appTsx = read(path.join(REPO, 'admin-portal/src/App.tsx'));
  const keys = read(path.join(REPO, 'src/modules/payroll-cycle/constants/governance-policy-keys.ts'));
  const resolve = read(path.join(REPO, 'src/modules/payruns/payrun-governance-policy-resolution.service.ts'));
  const fin = read(path.join(REPO, 'src/modules/payruns/payrun-financial-control.service.ts'));
  const bank = read(path.join(REPO, 'src/modules/payruns/payrun-bank-reconciliation.service.ts'));
  const gl = read(path.join(REPO, 'src/modules/payruns/payrun-gl-reconciliation.service.ts'));
  const readiness = read(path.join(REPO, 'src/modules/payruns/payrun-readiness-gate.service.ts'));
  const closed = read(path.join(REPO, 'src/modules/payruns/payrun-closed-period-mutation-guard.service.ts'));
  const payrunsMod = read(path.join(REPO, 'src/modules/payruns/payruns.module.ts'));
  const resSpec = read(path.join(REPO, 'src/modules/payruns/__tests__/payrun-governance-policy-resolution.service.spec.ts'));
  const doc = read(path.join(REPO, 'docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md'));
  const e2eGovPolicies = read(path.join(REPO, 'test/playwright/governance-policies-admin.spec.ts'));
  const pkg = read(path.join(REPO, 'package.json'));
  const ci = read(path.join(REPO, '.github/workflows/ci.yml'));

  if (!mig.includes('payroll_governance_policies') || !mig.includes('GovernancePolicyScope')) {
    fail('Migration must create payroll_governance_policies + GovernancePolicyScope enum.');
  }
  if (!schema.includes('model PayrollGovernancePolicy') || !schema.includes('enum GovernancePolicyScope')) {
    fail('prisma/schema.prisma must define PayrollGovernancePolicy and GovernancePolicyScope.');
  }
  if (!schema.includes('model PayrollGovernancePolicyDraft') || !schema.includes('enum GovernancePolicyDraftStatus')) {
    fail('prisma/schema.prisma must define PayrollGovernancePolicyDraft and GovernancePolicyDraftStatus (GOV-7B).');
  }
  for (const col of [
    'policyKey',
    'currentValue',
    'effectiveFrom',
    'changedByUserId',
    'approvalReference',
    'supersededByPolicyId',
  ]) {
    if (!schema.includes(col)) {
      fail(`PayrollGovernancePolicy must include field: ${col}`);
    }
  }
  if (!svc.includes('PayrollGovernancePolicyService') || !svc.includes('GOV_POLICY_VERSION_CREATE')) {
    fail('PayrollGovernancePolicyService must exist and audit policy version creates.');
  }
  if (!svc.includes('supersededByPolicyId') || !svc.includes('$transaction')) {
    fail('Policy service must version via transaction + supersede prior head.');
  }
  if (!ctrl.includes('governance-policies') || !ctrl.includes('listGovernancePolicies')) {
    fail('PayrollCycleController must expose governance-policies list.');
  }
  {
    const m = ctrl.match(/@Get\('governance-policies'\)\s*@UseGuards\([^\)]*\)\s*@Permissions\('([^']+)'\)/);
    if (!m || m[1] !== 'payrun:admin') {
      fail('GET governance-policies (exact path) must require payrun:admin for GOV-6C.');
    }
  }
  if (!ctrl.includes('listGovernancePolicyHistory') || !ctrl.includes(`'governance-policies/history'`)) {
    fail('PayrollCycleController must expose governance-policies/history for supersession chain (GOV-6C).');
  }
  if (!ctrl.includes('createGovernancePolicyVersion') || !ctrl.includes('payrun:admin')) {
    fail('PayrollCycleController must expose governance policy create with payrun:admin.');
  }
  if (
    !ctrl.includes('governance-policies/drafts') ||
    !ctrl.includes('createGovernancePolicyDraft') ||
    !ctrl.includes('rejectGovernancePolicyDraft') ||
    !ctrl.includes('cancelGovernancePolicyDraft')
  ) {
    fail('PayrollCycleController must expose GOV-7B / GOV-7B-2 governance-policies/drafts routes.');
  }
  if (!ctrl.includes('governance-policies/impact-preview') || !ctrl.includes('governancePolicyImpactPreview')) {
    fail('PayrollCycleController must expose POST governance-policies/impact-preview (GOV-7A).');
  }
  if (!svc.includes('validateGovernancePolicyValue') || !svc.includes('listPolicyVersionHistory')) {
    fail('PayrollGovernancePolicyService must validate values and support version history (GOV-6C).');
  }
  if (!svc.includes('governancePolicyImpactPreview') || !svc.includes('impact_preview_hash')) {
    fail('PayrollGovernancePolicyService must implement impact preview and POST hash gate (GOV-7A).');
  }
  if (
    !svc.includes('GOV_POLICY_DRAFT_CREATE') ||
    !svc.includes('GOV_POLICY_DRAFT_SUBMIT') ||
    !svc.includes('GOV_POLICY_DRAFT_APPROVE') ||
    !svc.includes('GOV_POLICY_DRAFT_ACTIVATE') ||
    !svc.includes('GOV_POLICY_DRAFT_REJECT') ||
    !svc.includes('GOV_POLICY_DRAFT_CANCEL')
  ) {
    fail('PayrollGovernancePolicyService must audit GOV-7B / GOV-7B-2 draft lifecycle actions.');
  }
  if (!svc.includes('GOV_POLICY_DIRECT_CREATE_DEPRECATED') || !svc.includes('createGovernancePolicyDraft')) {
    fail('PayrollGovernancePolicyService must implement GOV-7B drafts and deprecate direct create.');
  }
  if (!svc.includes('GOV_POLICY_IMPACT_PREVIEW')) {
    fail('Impact preview must write GOV_POLICY_IMPACT_PREVIEW audit action.');
  }
  if (!hashSrc.includes('computeGovernancePolicyImpactPayloadHash')) {
    fail('governance-policy-payload-hash.ts must export computeGovernancePolicyImpactPayloadHash.');
  }
  if (!impactDto.includes('GovernancePolicyImpactPreviewResponseDto')) {
    fail('governance-policy-impact.dto.ts must define GovernancePolicyImpactPreviewResponseDto.');
  }
  if (!hashSpec.includes('GOV-7A')) {
    fail('governance-policy-payload-hash.spec.ts must reference GOV-7A.');
  }
  if (!valSrc.includes('validateGovernancePolicyValue')) {
    fail('governance-policy-value.validator.ts must export validateGovernancePolicyValue.');
  }
  if (!valSpec.includes('GOV-6C')) {
    fail('governance-policy-value.validator.spec.ts must reference GOV-6C.');
  }
  if (!govUi.includes('/payroll/governance-policies') || !govUi.includes('payrun:admin')) {
    fail('GovernancePolicies admin page must register route context and payrun:admin gate.');
  }
  if (!govUi.includes('impact-preview') || !govUi.includes('Run impact preview')) {
    fail('GovernancePolicies must integrate GOV-7A impact preview (Run impact preview).');
  }
  if (!govUi.includes('governance-policies/drafts') || !govUi.includes('GOV-7B')) {
    fail('GovernancePolicies must use GOV-7B draft API paths.');
  }
  if (!govUi.includes('GOV-7B-2') || !govUi.includes('/reject') || !govUi.includes('/cancel')) {
    fail('GovernancePolicies must integrate GOV-7B-2 reject/cancel (API paths).');
  }
  if (!govUi.includes('Reject') || !govUi.includes('Cancel')) {
    fail('GovernancePolicies must expose Reject and Cancel draft actions.');
  }
  if (govUi.includes("api.post('/api/payroll-cycle/governance-policies',")) {
    fail('GovernancePolicies must not call deprecated POST /governance-policies (GOV-7B).');
  }
  if (!appTsx.includes('GovernancePolicies') || !appTsx.includes('/payroll/governance-policies')) {
    fail('admin-portal App.tsx must route /payroll/governance-policies to GovernancePolicies.');
  }
  if (!mod.includes('PayrollGovernancePolicyService') || !mod.includes('AuditModule')) {
    fail('PayrollCycleModule must register policy service and import AuditModule.');
  }
  if (!dto.includes('GovernancePolicyRecordDto')) {
    fail('governance-policy.dto.ts must define GovernancePolicyRecordDto.');
  }
  if (!spec.includes('GOV-6A') || !spec.includes('GOV-6C') || !spec.includes('GOV-7A') || !spec.includes('GOV-7B-2')) {
    fail('payroll-governance-policy.service.spec.ts must reference GOV-6A, GOV-6C, GOV-7A, and GOV-7B-2.');
  }
  if (!keys.includes('financial_control.net_variance_threshold') || !keys.includes('closed_period.mutation_policy')) {
    fail('governance-policy-keys.ts must define GOV-6B canonical keys.');
  }
  if (!resolve.includes('PayrunGovernancePolicyResolutionService') || !resolve.includes('SCOPE_RANK')) {
    fail('PayrunGovernancePolicyResolutionService must implement scoped resolution.');
  }
  if (!fin.includes('GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD') || !fin.includes('governance_policy_id')) {
    fail('PayrunFinancialControlService must resolve GOV-6B financial threshold and audit policy provenance.');
  }
  if (!bank.includes('GOV_POLICY_KEY_BANK_FEE_TOLERANCE') || !bank.includes('fee_tolerance_applied')) {
    fail('PayrunBankReconciliationService must resolve bank fee tolerance and audit policy provenance.');
  }
  if (!gl.includes('GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE') || !gl.includes('gl_rounding_tolerance_applied')) {
    fail('PayrunGLReconciliationService must resolve GL rounding tolerance and audit policy provenance.');
  }
  if (!readiness.includes('resolveJustificationMinForContext')) {
    fail('PayrunReadinessGateService must use policy-backed justification minimum.');
  }
  if (!closed.includes('GOVERNED_PATHS_ONLY') || !closed.includes('resolveClosedPeriodMutationMode')) {
    fail('PayrunClosedPeriodMutationGuardService must enforce closed_period.mutation_policy (GOV-6B).');
  }
  if (!payrunsMod.includes('PayrunGovernancePolicyResolutionService')) {
    fail('PayrunsModule must register PayrunGovernancePolicyResolutionService.');
  }
  if (!resSpec.includes('GOV-6B') || !resSpec.includes('GOV-6B-LOCK')) {
    fail('payrun-governance-policy-resolution.service.spec.ts must reference GOV-6B and GOV-6B-LOCK.');
  }
  if (!doc.includes('## GOV-6') || !doc.includes('GOV-6A') || !doc.includes('PayrollGovernancePolicy')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document GOV-6 / GOV-6A registry.');
  }
  if (!doc.includes('### GOV-6B') || !doc.includes('PayrunGovernancePolicyResolutionService')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document GOV-6B enforcement.');
  }
  if (!doc.includes('### GOV-6C') || !doc.includes('GovernancePolicies')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document GOV-6C policy administration UI.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-6C')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-6C anchors.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-6C-LOCK') || !doc.includes('Policy administration baseline locked')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-6C-LOCK baseline.');
  }
  if (!doc.includes('impact-preview') || !doc.includes('impact_preview_hash')) {
    fail('Control plane doc must document GOV-7A impact-preview and impact_preview_hash.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-7A-LOCK') || !doc.includes('Policy diff / impact simulation baseline locked')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-7A-LOCK baseline.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-7B-LOCK') || !doc.includes('Policy change approval baseline locked')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-7B-LOCK baseline.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-7B-2') || !doc.includes('Reject / Cancel')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-7B-2 reject/cancel slice.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-7B-2-LOCK') || !doc.includes('Reject/cancel are baseline locked')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-7B-2-LOCK baseline.');
  }
  if (
    !e2eGovPolicies.includes('GOV-6C') ||
    !e2eGovPolicies.includes('GOV-7A') ||
    !e2eGovPolicies.includes('GOV-7B') ||
    !e2eGovPolicies.includes('GOV-7B-2') ||
    !e2eGovPolicies.includes('payrun:admin') ||
    !e2eGovPolicies.includes('impact-preview')
  ) {
    fail('test/playwright/governance-policies-admin.spec.ts must anchor GOV-6C, GOV-7A, GOV-7B, GOV-7B-2, payrun:admin, and impact-preview.');
  }
  if (!doc.includes('PR-PAYRUN-GOV-6B-LOCK') || !doc.includes('Policy-backed enforcement baseline locked')) {
    fail('docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md must document PR-PAYRUN-GOV-6B-LOCK baseline.');
  }
  if (!doc.includes('check:payrun-governance-policy-drift')) {
    fail('Control plane doc must list check:payrun-governance-policy-drift.');
  }
  if (!pkg.includes('check:payrun-governance-policy-drift')) {
    fail('package.json must register check:payrun-governance-policy-drift.');
  }
  if (!ci.includes('check:payrun-governance-policy-drift')) {
    fail('CI workflow must run check:payrun-governance-policy-drift.');
  }

  console.log('[check:payrun-governance-policy-drift] OK');
}

main();
