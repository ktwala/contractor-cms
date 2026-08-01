/**
 * Canonical permission constants — frontend copy.
 *
 * Must stay in sync with: src/common/constants/permissions.ts (backend)
 *
 * These are the EXACT strings stored in the JWT / localStorage.
 * Frontend `can()` checks must use these constants, not ad-hoc strings.
 */

export const P = {
  // ── Tax Table Authoring ──────────────────────────────────────────────
  TTA_VIEW: 'tax_table_authoring_view',
  TTA_CREATE: 'tax_table_authoring_create',
  TTA_IMPORT: 'tax_table_authoring_import',
  TTA_EDIT: 'tax_table_authoring_edit',
  TTA_SUBMIT_APPROVAL: 'tax_table_authoring_submit_approval',
  TTA_APPROVE: 'tax_table_authoring_approve',
  TTA_PUBLISH: 'tax_table_authoring_publish',
  TTA_ARCHIVE: 'tax_table_authoring_archive',
  TTA_AUDIT_VIEW: 'tax_table_authoring_audit_view',

  // ── Payrun ───────────────────────────────────────────────────────────
  PAYRUN_READ: 'payrun:read',
  PAYRUN_CREATE: 'payrun:create',
  PAYRUN_EDIT: 'payrun:edit',
  PAYRUN_SNAPSHOT: 'payrun:snapshot',
  PAYRUN_CANCEL: 'payrun:cancel',
  PAYRUN_CALCULATE: 'payrun:calculate',
  PAYRUN_SUBMIT: 'payrun:submit',
  PAYRUN_ADJUST: 'payrun:adjust',
  PAYRUN_APPROVE: 'payrun:approve',
  PAYRUN_PAY: 'payrun:pay',
  PAYRUN_POST: 'payrun:post',
  PAYRUN_FINALIZE: 'payrun:finalize',
  PAYRUN_TRACE_READ: 'payrun:trace:read',
  PAYRUN_ADMIN: 'payrun:admin',
  PAYRUN_GL_OVERRIDE: 'payrun:gl_override',
  PAYRUN_CLOSED_PERIOD_OVERRIDE: 'payrun:closed_period_override',

  // ── Payroll Cycle ────────────────────────────────────────────────────
  CALENDARS_VIEW: 'payroll:calendars:view',
  CALENDARS_CREATE: 'payroll:calendars:create',
  CALENDARS_MANAGE: 'payroll:calendars:manage',
  PERIODS_VIEW: 'payroll:periods:view',
  CHECKLISTS_VIEW: 'payroll:checklists:view',
  CHECKLISTS_CREATE: 'payroll:checklists:create',
  CHECKLISTS_COMPLETE: 'payroll:checklists:complete',
  CHECKLISTS_ASSIGN: 'payroll:checklists:assign',
  EXCEPTIONS_VIEW: 'payroll:exceptions:view',
  EXCEPTIONS_DETECT: 'payroll:exceptions:detect',
  EXCEPTIONS_RESOLVE: 'payroll:exceptions:resolve',
  EXCEPTIONS_DISMISS: 'payroll:exceptions:dismiss',
  RECONCILIATION_VIEW: 'payroll:reconciliation:view',
  RECONCILIATION_CREATE: 'payroll:reconciliation:create',
  RECONCILIATION_MANAGE: 'payroll:reconciliation:manage',
  FORECASTS_VIEW: 'payroll:forecasts:view',
  FORECASTS_CREATE: 'payroll:forecasts:create',
  FORECASTS_MANAGE: 'payroll:forecasts:manage',

  PAYROLL_CONTAINERS_CLOSE: 'payroll:containers:close',
  PAYROLL_CONTAINERS_ARCHIVE: 'payroll:containers:archive',

  // ── Payment Batches ──────────────────────────────────────────────────
  PAYMENT_BATCH_READ: 'payment_batch:read',
  PAYMENT_BATCH_CREATE: 'payment_batch:create',
  PAYMENT_BATCH_EXPORT: 'payment_batch:export',
  PAYMENT_BATCH_UPDATE: 'payment_batch:update',
  PAYMENT_BATCH_CONFIRM_PAID: 'payment_batch:confirm_paid',
  PAYMENT_BATCH_AUDIT_READ: 'payment_batch:audit:read',

  // ── Compliance ───────────────────────────────────────────────────────
  COMPLIANCE_READ: 'compliance:read',
  COMPLIANCE_WRITE: 'compliance:write',

  // ── Reports ──────────────────────────────────────────────────────────
  REPORT_PAYSLIP_READ: 'report:payslip:read',
  REPORT_BANKFILE_READ: 'report:bankfile:read',
  REPORT_BANKFILE_GENERATE: 'report:bankfile:generate',
  REPORT_GLJOURNAL_READ: 'report:gljournal:read',
  REPORT_SUMMARY_READ: 'report:summary:read',

  // ── Tax (legacy runtime) ─────────────────────────────────────────────
  TAX_READ: 'tax:read',
  TAX_WRITE: 'tax:write',

  // ── CTC Optimiser ─────────────────────────────────────────────────
  CTC_OPTIMISER_RUN: 'payroll:ctc_optimiser:run',
  CTC_OPTIMISER_VIEW: 'payroll:ctc_optimiser:view',
  CTC_OPTIMISER_APPLY: 'payroll:ctc_optimiser:apply',
  CTC_OPTIMISER_APPROVE: 'payroll:ctc_optimiser:approve',

  // ── Recruitment: Requisitions ───────────────────────────────────
  RECRUITMENT_REQUISITIONS_CREATE: 'recruitment:requisitions:create',
  RECRUITMENT_REQUISITIONS_VIEW: 'recruitment:requisitions:view',
  RECRUITMENT_REQUISITIONS_UPDATE: 'recruitment:requisitions:update',
  RECRUITMENT_REQUISITIONS_APPROVE: 'recruitment:requisitions:approve',
  RECRUITMENT_REQUISITIONS_POST: 'recruitment:requisitions:post',
  RECRUITMENT_REQUISITIONS_MANAGE: 'recruitment:requisitions:manage',

  // ── Recruitment: Candidates ─────────────────────────────────────
  RECRUITMENT_CANDIDATES_CREATE: 'recruitment:candidates:create',
  RECRUITMENT_CANDIDATES_VIEW: 'recruitment:candidates:view',

  // ── Recruitment: Applications ───────────────────────────────────
  RECRUITMENT_APPLICATIONS_CREATE: 'recruitment:applications:create',
  RECRUITMENT_APPLICATIONS_VIEW: 'recruitment:applications:view',
  RECRUITMENT_APPLICATIONS_MANAGE: 'recruitment:applications:manage',
  RECRUITMENT_APPLICATIONS_RATE: 'recruitment:applications:rate',

  // ── Recruitment: Interviews ─────────────────────────────────────
  RECRUITMENT_INTERVIEWS_SCHEDULE: 'recruitment:interviews:schedule',
  RECRUITMENT_INTERVIEWS_VIEW: 'recruitment:interviews:view',
  RECRUITMENT_INTERVIEWS_FEEDBACK: 'recruitment:interviews:feedback',
  RECRUITMENT_INTERVIEWS_MANAGE: 'recruitment:interviews:manage',

  // ── Recruitment: Offers ─────────────────────────────────────────
  RECRUITMENT_OFFERS_CREATE: 'recruitment:offers:create',
  RECRUITMENT_OFFERS_APPROVE: 'recruitment:offers:approve',
  RECRUITMENT_OFFERS_SEND: 'recruitment:offers:send',
  RECRUITMENT_OFFERS_VIEW: 'recruitment:offers:view',

  // ── Recruitment: Onboarding ─────────────────────────────────────
  RECRUITMENT_ONBOARDING_CREATE: 'recruitment:onboarding:create',
  RECRUITMENT_ONBOARDING_VIEW: 'recruitment:onboarding:view',
  RECRUITMENT_ONBOARDING_COMPLETE_TASKS: 'recruitment:onboarding:complete_tasks',
  RECRUITMENT_ONBOARDING_MANAGE_DOCUMENTS: 'recruitment:onboarding:manage_documents',
  RECRUITMENT_ONBOARDING_UPLOAD_DOCUMENTS: 'recruitment:onboarding:upload_documents',
  RECRUITMENT_ONBOARDING_VERIFY_DOCUMENTS: 'recruitment:onboarding:verify_documents',
  RECRUITMENT_ONBOARDING_MANAGE_EQUIPMENT: 'recruitment:onboarding:manage_equipment',
  RECRUITMENT_ONBOARDING_ASSIGN_EQUIPMENT: 'recruitment:onboarding:assign_equipment',
  RECRUITMENT_ONBOARDING_MANAGE_ACCESS: 'recruitment:onboarding:manage_access',
  RECRUITMENT_ONBOARDING_PROVISION_ACCESS: 'recruitment:onboarding:provision_access',
} as const;

export type PermissionCode = (typeof P)[keyof typeof P];

export const CTC_OPTIMISER_PERMISSIONS = {
  run: P.CTC_OPTIMISER_RUN,
  view: P.CTC_OPTIMISER_VIEW,
  apply: P.CTC_OPTIMISER_APPLY,
  approve: P.CTC_OPTIMISER_APPROVE,
} as const;
