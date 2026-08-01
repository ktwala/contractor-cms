/**
 * Canonical permission constants — single source of truth.
 *
 * Used by:
 *  - Backend controller guards (@Permissions decorator)
 *  - Seed file (prisma/seed.ts)
 *  - Frontend permission hooks (via admin-portal copy)
 *  - Regression tests
 *
 * Naming convention:  module:resource:action  (colons)
 *
 * To add a new permission:
 *  1. Add the constant here
 *  2. Add to prisma/seed.ts PERMISSIONS array
 *  3. Add to relevant ROLE_PERM_MAP bundles in seed
 *  4. Copy to admin-portal/src/constants/permissions.ts
 *  5. Run sync script in live environments
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
  /** GOV-3C — accounting-grade override for register ↔ GL gate (period close). */
  PAYRUN_GL_OVERRIDE: 'payrun:gl_override',
  /** GOV-3D-1 — auditable bypass for register / lifecycle mutations after pay period close. */
  PAYRUN_CLOSED_PERIOD_OVERRIDE: 'payrun:closed_period_override',

  // ── Payroll Cycle ────────────────────────────────────────────────────
  CALENDARS_VIEW: 'payroll:calendars:view',
  CALENDARS_CREATE: 'payroll:calendars:create',
  CALENDARS_MANAGE: 'payroll:calendars:manage',
  PERIODS_VIEW: 'payroll:periods:view',
  PERIODS_LOCK: 'payroll:periods:lock',
  PERIODS_UNLOCK: 'payroll:periods:unlock',
  PERIODS_CLOSE: 'payroll:periods:close',
  PERIODS_MANAGE: 'payroll:periods:manage',
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

  /** PR-PAYROLL-CONTAINER-4 — tax-year shell lifecycle (audited POST only; no hard delete). */
  PAYROLL_CONTAINERS_CLOSE: 'payroll:containers:close',
  PAYROLL_CONTAINERS_ARCHIVE: 'payroll:containers:archive',

  // ── Payment Batches ──────────────────────────────────────────────────
  PAYMENT_BATCH_READ: 'payment_batch:read',
  PAYMENT_BATCH_CREATE: 'payment_batch:create',
  PAYMENT_BATCH_EXPORT: 'payment_batch:export',
  PAYMENT_BATCH_UPDATE: 'payment_batch:update',
  PAYMENT_BATCH_CONFIRM_PAID: 'payment_batch:confirm_paid',
  PAYMENT_BATCH_AUDIT_READ: 'payment_batch:audit:read',

  // ── SARS ─────────────────────────────────────────────────────────────
  SARS_TAX_PERIODS_READ: 'sars:tax_periods:read',
  SARS_IRP5_READ: 'sars:irp5:read',
  SARS_IRP5_GENERATE: 'sars:irp5:generate',
  SARS_IRP5_EXPORT: 'sars:irp5:export',
  SARS_IRP5_EMAIL: 'sars:irp5:email',
  SARS_EMP201_READ: 'sars:emp201:read',
  SARS_EMP201_GENERATE: 'sars:emp201:generate',
  SARS_EMP201_EXPORT: 'sars:emp201:export',
  SARS_EMP201_SUBMIT: 'sars:emp201:submit',
  SARS_EMP501_READ: 'sars:emp501:read',
  SARS_EMP501_GENERATE: 'sars:emp501:generate',
  SARS_EMP501_EXPORT: 'sars:emp501:export',
  SARS_EMP501_APPROVE: 'sars:emp501:approve',
  SARS_VALIDATION_RUN: 'sars:validation:run',
  SARS_SUBMISSION_MANAGE: 'sars:submission:manage',
  SARS_SUBMISSION_READ: 'sars:submission:read',

  // ── Compliance ───────────────────────────────────────────────────────
  COMPLIANCE_READ: 'compliance:read',
  COMPLIANCE_WRITE: 'compliance:write',
  COMPLIANCE_DELETE: 'compliance:delete',

  // ── Reports ──────────────────────────────────────────────────────────
  REPORT_PAYSLIP_READ: 'report:payslip:read',
  REPORT_BANKFILE_READ: 'report:bankfile:read',
  REPORT_BANKFILE_GENERATE: 'report:bankfile:generate',
  REPORT_GLJOURNAL_READ: 'report:gljournal:read',
  REPORT_SUMMARY_READ: 'report:summary:read',

  // ── Tax (legacy runtime) ─────────────────────────────────────────────
  TAX_READ: 'tax:read',
  TAX_WRITE: 'tax:write',

  // ── IAM / Auth ───────────────────────────────────────────────────────
  AUTH_READ: 'auth:read',
  IAM_USERS_MANAGE: 'iam:users:manage',
  IAM_ROLES_MANAGE: 'iam:roles:manage',
  IAM_PERMISSIONS_MANAGE: 'iam:permissions:manage',
  IAM_LEGAL_ENTITIES_MANAGE: 'iam:legal_entities:manage',
  AUDIT_EVENTS_READ: 'audit:events:read',

  // ── HCM ──────────────────────────────────────────────────────────────
  EMPLOYEE_READ: 'employee:read',
  EMPLOYEE_WRITE: 'employee:write',
  EMPLOYMENT_READ: 'employment:read',
  EMPLOYMENT_WRITE: 'employment:write',
  LEGAL_ENTITY_READ: 'legal_entity:read',
  LEGAL_ENTITY_WRITE: 'legal_entity:write',
  PAY_GROUP_READ: 'pay_group:read',
  PAY_GROUP_WRITE: 'pay_group:write',
  PAY_PERIOD_READ: 'pay_period:read',
  PAY_PERIOD_WRITE: 'pay_period:write',
  COMPENSATION_READ: 'compensation:read',
  COMPENSATION_WRITE: 'compensation:write',
  BANK_ACCOUNT_READ: 'bank_account:read',
  BANK_ACCOUNT_WRITE: 'bank_account:write',
  TAX_PROFILE_READ: 'tax_profile:read',
  TAX_PROFILE_WRITE: 'tax_profile:write',
  HR_READ: 'hr:read',

  // ── Data Import ──────────────────────────────────────────────────────
  DATA_IMPORT_READ: 'data_import:read',
  DATA_IMPORT_WRITE: 'data_import:write',
  DATA_IMPORT_APPROVE: 'data_import:approve',
  DATA_IMPORT_PUBLISH: 'data_import:publish',

  // ── Self-Service ─────────────────────────────────────────────────────
  SELF_PAYSLIPS_READ: 'self:payslips:read',
  SELF_TAX_READ: 'self:tax:read',
  SELF_PROFILE_READ: 'self:profile:read',
  SELF_PROFILE_UPDATE: 'self:profile:update',

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

export const CTC_OPTIMISER_ALL = Object.values(CTC_OPTIMISER_PERMISSIONS);

export const RECRUITMENT_PERMISSIONS = {
  requisitions: {
    create: P.RECRUITMENT_REQUISITIONS_CREATE,
    view: P.RECRUITMENT_REQUISITIONS_VIEW,
    update: P.RECRUITMENT_REQUISITIONS_UPDATE,
    approve: P.RECRUITMENT_REQUISITIONS_APPROVE,
    post: P.RECRUITMENT_REQUISITIONS_POST,
    manage: P.RECRUITMENT_REQUISITIONS_MANAGE,
  },
  candidates: {
    create: P.RECRUITMENT_CANDIDATES_CREATE,
    view: P.RECRUITMENT_CANDIDATES_VIEW,
  },
  applications: {
    create: P.RECRUITMENT_APPLICATIONS_CREATE,
    view: P.RECRUITMENT_APPLICATIONS_VIEW,
    manage: P.RECRUITMENT_APPLICATIONS_MANAGE,
    rate: P.RECRUITMENT_APPLICATIONS_RATE,
  },
  interviews: {
    schedule: P.RECRUITMENT_INTERVIEWS_SCHEDULE,
    view: P.RECRUITMENT_INTERVIEWS_VIEW,
    feedback: P.RECRUITMENT_INTERVIEWS_FEEDBACK,
    manage: P.RECRUITMENT_INTERVIEWS_MANAGE,
  },
  offers: {
    create: P.RECRUITMENT_OFFERS_CREATE,
    approve: P.RECRUITMENT_OFFERS_APPROVE,
    send: P.RECRUITMENT_OFFERS_SEND,
    view: P.RECRUITMENT_OFFERS_VIEW,
  },
  onboarding: {
    create: P.RECRUITMENT_ONBOARDING_CREATE,
    view: P.RECRUITMENT_ONBOARDING_VIEW,
    complete_tasks: P.RECRUITMENT_ONBOARDING_COMPLETE_TASKS,
    manage_documents: P.RECRUITMENT_ONBOARDING_MANAGE_DOCUMENTS,
    upload_documents: P.RECRUITMENT_ONBOARDING_UPLOAD_DOCUMENTS,
    verify_documents: P.RECRUITMENT_ONBOARDING_VERIFY_DOCUMENTS,
    manage_equipment: P.RECRUITMENT_ONBOARDING_MANAGE_EQUIPMENT,
    assign_equipment: P.RECRUITMENT_ONBOARDING_ASSIGN_EQUIPMENT,
    manage_access: P.RECRUITMENT_ONBOARDING_MANAGE_ACCESS,
    provision_access: P.RECRUITMENT_ONBOARDING_PROVISION_ACCESS,
  },
} as const;

export const RECRUITMENT_ALL: PermissionCode[] = Object.values(RECRUITMENT_PERMISSIONS)
  .flatMap((group) => Object.values(group)) as PermissionCode[];
