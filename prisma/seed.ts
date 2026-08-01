/**
 * Hubsec Workforce Platform - Roles & Permissions Seed
 *
 * Creates the canonical RBAC foundation:
 * - Roles
 * - Permissions
 * - Role-permission mappings
 *
 * Idempotent: safe to run repeatedly. Does not delete users or existing data.
 * Required before bootstrap:admin or demo:seed.
 *
 * Run: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { describeDatabaseTargetFromUrl, loadRepoEnvForPrismaSeeds } from './seed-env';

const pool = new Pool(loadRepoEnvForPrismaSeeds());
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ROLES: { name: string; description: string }[] = [
  {
    name: 'TENANT_ADMIN',
    description:
      'Tenant-wide administration (IAM, entities, broad operational entitlements). Per PR-RBAC-GOV-2: does not carry routine payrun GOV-3A–3D override permissions — assign PAYROLL_MANAGER / PAYMENT_OPERATOR / FINANCE_REVIEWER / GLOBAL_PAYROLL_ADMIN as needed.',
  },
  { name: 'PAYROLL_CLERK', description: 'Prepare payruns (create, edit, snapshot, calculate, submit)' },
  { name: 'PAYROLL_APPROVER', description: 'Approve payruns (not create)' },
  { name: 'FINANCE_APPROVER', description: 'Release payments (mark paid)' },
  { name: 'SARS_OFFICER', description: 'Generate + export + validate SARS documents' },
  { name: 'SARS_APPROVER', description: 'Submit + approve SARS reconciliation' },
  { name: 'AUDITOR_READONLY', description: 'Read-only audit (no exports by default)' },
  { name: 'EMPLOYEE_SELF_SERVICE', description: 'Self-service payslips, tax, profile' },
  { name: 'PLATFORM_SUPERADMIN', description: 'Break-glass only - full platform access' },
  { name: 'INTEGRATION_IGA', description: 'IGA/connector service account - HR export (delta, employee_no) only' },
  { name: 'HR_ADMIN', description: 'HCM: employees and employments (read/write)' },
  { name: 'PAYROLL_PROCESSOR', description: 'Creates and calculates payroll, reviews results, and resolves exceptions within assigned scope.' },
  { name: 'PAYROLL_MANAGER', description: 'Owns payroll operations end to end within assigned scope.' },
  { name: 'PAYMENT_OPERATOR', description: 'Manages payment batches and payment confirmation within assigned scope.' },
  { name: 'RECONCILIATION_ANALYST', description: 'Reviews and validates payroll, payment, and reconciliation integrity.' },
  { name: 'FINANCE_REVIEWER', description: 'Reviews payroll totals, reports, and reconciliation outputs.' },
  { name: 'COMPLIANCE_OFFICER', description: 'Generates and submits statutory outputs within assigned country scope.' },
  { name: 'TAX_TABLE_ADMINISTRATOR', description: 'Maintains country-specific tax tables only.' },
  { name: 'EXECUTIVE_READONLY', description: 'High-level payroll reporting and analytics visibility with no operational mutation.' },
  { name: 'GLOBAL_PAYROLL_ADMIN', description: 'Cross-country payroll operations administrator.' },
  { name: 'GLOBAL_COMPLIANCE_ADMIN', description: 'Cross-country statutory and tax configuration administrator.' },
  { name: 'TALENT_ADMIN', description: 'Full recruitment and onboarding control across all talent functions.' },
  { name: 'RECRUITER', description: 'Operational recruitment pipeline management — no approval powers.' },
  { name: 'HIRING_MANAGER', description: 'Approves requisitions and makes hiring decisions.' },
  { name: 'INTERVIEWER', description: 'View assigned interviews and submit feedback.' },
  { name: 'HR_OPERATIONS', description: 'Post-offer onboarding operations — documents, equipment, access.' },
];

const PAY_ITEMS = [
  { code: 'BASIC_SALARY', name: 'Basic Salary', description: 'Core basic salary', type: 'EARNING', category: 'CORE', isSystem: true, sortOrder: 10 },
  { code: 'PENSION', name: 'Pension Contribution', description: 'Employee pension fund contribution', type: 'DEDUCTION', category: 'RETIREMENT', isSystem: true, sortOrder: 20 },
  { code: 'MEDICAL_AID', name: 'Medical Aid', description: 'Medical aid deduction', type: 'DEDUCTION', category: 'HEALTH', isSystem: true, sortOrder: 30 },
  { code: 'UIF', name: 'UIF', description: 'Unemployment Insurance Fund', type: 'DEDUCTION', category: 'STATUTORY', isSystem: true, sortOrder: 40 },
  { code: 'UNION_FEE', name: 'Union Fee', description: 'Trade union membership fee', type: 'DEDUCTION', category: 'OPTIONAL', isSystem: true, sortOrder: 50 },
  { code: 'STAFF_LOAN', name: 'Staff Loan', description: 'Staff loan repayment', type: 'DEDUCTION', category: 'LOAN', isSystem: true, sortOrder: 60 },
];

const PERMISSIONS: { code: string; description: string }[] = [
  { code: 'auth:read', description: 'Read own auth context' },
  { code: 'iam:users:manage', description: 'Manage users' },
  { code: 'iam:roles:manage', description: 'Manage roles' },
  { code: 'iam:permissions:manage', description: 'Manage permissions' },
  { code: 'iam:legal_entities:manage', description: 'Manage legal entity assignments' },
  { code: 'audit:events:read', description: 'Read audit events' },
  { code: 'payrun:read', description: 'View payruns' },
  { code: 'payrun:create', description: 'Create payruns' },
  { code: 'payrun:edit', description: 'Edit payruns' },
  { code: 'payrun:snapshot', description: 'Snapshot payruns' },
  { code: 'payrun:cancel', description: 'Cancel payruns (terminal, pre-execution)' },
  { code: 'payrun:calculate', description: 'Calculate payruns' },
  { code: 'payrun:submit', description: 'Submit payruns' },
  { code: 'payrun:adjust', description: 'Create adjustment payruns' },
  { code: 'payrun:approve', description: 'Approve payruns' },
  { code: 'payrun:pay', description: 'Mark payruns paid' },
  { code: 'payrun:post', description: 'Post payruns to GL' },
  { code: 'payrun:finalize', description: 'Finalize payruns' },
  {
    code: 'payrun:readiness_override',
    description: 'Override payroll readiness gate for payrun execution (audited; requires headers)',
  },
  {
    code: 'payrun:financial_override',
    description: 'Override payroll register vs payment export financial gate (audited; requires headers)',
  },
  {
    code: 'payrun:bank_override',
    description: 'Override payment export vs bank confirmation gate for mark posted (audited; treasury-grade)',
  },
  {
    code: 'payrun:gl_override',
    description: 'Override payroll register vs GL posting gate for period close (audited; accounting-grade)',
  },
  {
    code: 'payrun:closed_period_override',
    description:
      'GOV-3D-1: auditable bypass for register / lifecycle mutations after pay period close (requires justification headers)',
  },
  { code: 'payrun:trace:read', description: 'Read payrun trace' },
  { code: 'sars:tax_periods:read', description: 'Read tax periods' },
  { code: 'sars:irp5:read', description: 'Read IRP5 certificates' },
  { code: 'sars:irp5:generate', description: 'Generate IRP5 certificates' },
  { code: 'sars:irp5:export', description: 'Export IRP5' },
  { code: 'sars:emp201:read', description: 'Read EMP201 returns' },
  { code: 'sars:emp201:generate', description: 'Generate EMP201 returns' },
  { code: 'sars:emp201:export', description: 'Export EMP201' },
  { code: 'sars:emp201:submit', description: 'Submit EMP201' },
  { code: 'sars:emp501:read', description: 'Read EMP501 reconciliations' },
  { code: 'sars:emp501:generate', description: 'Generate EMP501 reconciliations' },
  { code: 'sars:emp501:export', description: 'Export EMP501' },
  { code: 'sars:emp501:approve', description: 'Approve EMP501' },
  { code: 'sars:validation:run', description: 'Run SARS validation' },
  { code: 'sars:submission:manage', description: 'Manage SARS submissions' },
  { code: 'sars:submission:read', description: 'Read SARS submissions' },
  { code: 'self:payslips:read', description: 'Read own payslips' },
  { code: 'self:tax:read', description: 'Read own tax info' },
  { code: 'self:profile:read', description: 'Read own profile' },
  { code: 'self:profile:update', description: 'Update own profile' },
  { code: 'hr:read', description: 'Read HR export API (employees delta, legal entities, by employee_no)' },
  { code: 'employee:read', description: 'List and view employees' },
  { code: 'employee:write', description: 'Create and update employees' },
  { code: 'employment:read', description: 'View employment history' },
  { code: 'employment:write', description: 'Create and update employments' },
  { code: 'legal_entity:read', description: 'List and view legal entities (required for employment forms)' },
  { code: 'legal_entity:write', description: 'Create and update legal entities' },
  { code: 'pay_group:read', description: 'List and view pay groups (required for employment forms)' },
  { code: 'compensation:read', description: 'View compensation history (effective-dated salary)' },
  { code: 'compensation:write', description: 'Add/update compensation records' },
  { code: 'bank_account:read', description: 'View bank accounts (masked)' },
  { code: 'bank_account:write', description: 'Add/update bank accounts' },
  { code: 'tax_profile:read', description: 'View tax profile history' },
  { code: 'tax_profile:write', description: 'Add/update tax profiles' },
  { code: 'data_import:read', description: 'View import jobs and validation results' },
  { code: 'data_import:write', description: 'Upload and validate imports' },
  { code: 'data_import:approve', description: 'Approve imports for publishing' },
  { code: 'data_import:publish', description: 'Publish approved imports to HCM core' },
  // Payroll Run Center & operational permissions
  { code: 'payrun:admin', description: 'Payrun admin actions (revert to draft)' },
  { code: 'payroll:calendars:view', description: 'View payroll calendars' },
  { code: 'payroll:calendars:create', description: 'Create payroll calendars' },
  { code: 'payroll:calendars:manage', description: 'Manage payroll calendars (generate periods)' },
  { code: 'payroll:periods:view', description: 'View payroll periods' },
  { code: 'payroll:periods:lock', description: 'Lock payroll periods' },
  { code: 'payroll:periods:unlock', description: 'Unlock payroll periods' },
  { code: 'payroll:periods:close', description: 'Close payroll periods' },
  { code: 'payroll:periods:manage', description: 'Manage payroll period status' },
  { code: 'payroll:containers:close', description: 'Close tax-year payroll shell (PLANNING/ACTIVE → CLOSED; audited)' },
  { code: 'payroll:containers:archive', description: 'Archive payroll shell when governance-safe (no row delete)' },
  { code: 'payroll:checklists:view', description: 'View payroll checklists' },
  { code: 'payroll:checklists:create', description: 'Create payroll checklists' },
  { code: 'payroll:checklists:complete', description: 'Complete payroll checklist tasks' },
  { code: 'payroll:checklists:assign', description: 'Assign payroll checklist tasks' },
  { code: 'payroll:exceptions:view', description: 'View payroll exceptions' },
  { code: 'payroll:exceptions:detect', description: 'Detect payroll exceptions' },
  { code: 'payroll:exceptions:resolve', description: 'Resolve payroll exceptions' },
  { code: 'payroll:exceptions:dismiss', description: 'Dismiss payroll exceptions' },
  { code: 'payroll:reconciliation:view', description: 'View payroll reconciliation' },
  { code: 'payroll:reconciliation:create', description: 'Create payroll reconciliation' },
  { code: 'payroll:reconciliation:manage', description: 'Manage payroll reconciliation' },
  { code: 'payroll:forecasts:view', description: 'View payroll forecasts' },
  { code: 'payroll:forecasts:create', description: 'Create payroll forecasts' },
  { code: 'payroll:forecasts:manage', description: 'Manage payroll forecasts' },
  { code: 'report:payslip:read', description: 'Read payslip reports' },
  { code: 'report:bankfile:read', description: 'Read bank file reports' },
  { code: 'report:bankfile:generate', description: 'Generate bank file reports' },
  { code: 'report:gljournal:read', description: 'Read GL journal reports' },
  { code: 'report:summary:read', description: 'Read payroll summary reports' },
  { code: 'compliance:read', description: 'Read compliance data' },
  { code: 'compliance:write', description: 'Write compliance data' },
  { code: 'compliance:delete', description: 'Delete compliance data' },
  { code: 'pay_period:read', description: 'View pay periods' },
  { code: 'pay_period:write', description: 'Manage pay periods' },
  { code: 'pay_group:write', description: 'Create and manage pay groups' },
  { code: 'tax:read', description: 'Read tax tables' },
  { code: 'tax:write', description: 'Manage tax tables' },
  // Tax Table Authoring (TTA) — must match src/common/constants/permissions.ts
  { code: 'tax_table_authoring_view', description: 'View tax table authoring drafts and runtime' },
  { code: 'tax_table_authoring_create', description: 'Create tax table authoring versions' },
  { code: 'tax_table_authoring_import', description: 'Import brackets into tax table authoring' },
  { code: 'tax_table_authoring_edit', description: 'Edit draft tax table authoring versions' },
  { code: 'tax_table_authoring_submit_approval', description: 'Submit tax table authoring for approval' },
  { code: 'tax_table_authoring_approve', description: 'Approve tax table authoring versions' },
  { code: 'tax_table_authoring_publish', description: 'Publish tax table authoring to runtime TaxTableSet' },
  { code: 'tax_table_authoring_archive', description: 'Archive tax table authoring versions' },
  { code: 'tax_table_authoring_audit_view', description: 'View tax table authoring audit trail' },
  { code: 'sars:irp5:email', description: 'Email IRP5 certificates' },
  // Payment Batch permissions
  { code: 'payment_batch:read', description: 'View payment batches' },
  { code: 'payment_batch:create', description: 'Create payment batches from payruns' },
  { code: 'payment_batch:export', description: 'Export payment batches' },
  { code: 'payment_batch:update', description: 'Update payment batch metadata' },
  { code: 'payment_batch:confirm_paid', description: 'Confirm payment batch as paid' },
  { code: 'payment_batch:audit:read', description: 'Read payment batch audit trail' },
  // CTC Optimiser
  { code: 'payroll:ctc_optimiser:run', description: 'Run CTC optimisation scenarios' },
  { code: 'payroll:ctc_optimiser:view', description: 'View CTC optimiser runs and results' },
  { code: 'payroll:ctc_optimiser:apply', description: 'Apply selected CTC scenario' },
  { code: 'payroll:ctc_optimiser:approve', description: 'Approve CTC optimiser decisions (phase 2)' },
  // Recruitment: Requisitions
  { code: 'recruitment:requisitions:create', description: 'Create job requisitions' },
  { code: 'recruitment:requisitions:view', description: 'View job requisitions' },
  { code: 'recruitment:requisitions:update', description: 'Update job requisitions' },
  { code: 'recruitment:requisitions:approve', description: 'Approve job requisitions' },
  { code: 'recruitment:requisitions:post', description: 'Post approved requisitions' },
  { code: 'recruitment:requisitions:manage', description: 'Close and manage requisitions' },
  // Recruitment: Candidates
  { code: 'recruitment:candidates:create', description: 'Create candidates' },
  { code: 'recruitment:candidates:view', description: 'View candidates' },
  // Recruitment: Applications
  { code: 'recruitment:applications:create', description: 'Submit applications' },
  { code: 'recruitment:applications:view', description: 'View applications' },
  { code: 'recruitment:applications:manage', description: 'Advance, reject, and manage applications' },
  { code: 'recruitment:applications:rate', description: 'Rate applications' },
  // Recruitment: Interviews
  { code: 'recruitment:interviews:schedule', description: 'Schedule interviews' },
  { code: 'recruitment:interviews:view', description: 'View interviews' },
  { code: 'recruitment:interviews:feedback', description: 'Submit interview feedback' },
  { code: 'recruitment:interviews:manage', description: 'Complete, cancel, and manage interviews' },
  // Recruitment: Offers
  { code: 'recruitment:offers:create', description: 'Create offers' },
  { code: 'recruitment:offers:approve', description: 'Approve offers' },
  { code: 'recruitment:offers:send', description: 'Send offers to candidates' },
  { code: 'recruitment:offers:view', description: 'View offers' },
  // Recruitment: Onboarding
  { code: 'recruitment:onboarding:create', description: 'Create onboarding workflows' },
  { code: 'recruitment:onboarding:view', description: 'View onboarding workflows' },
  { code: 'recruitment:onboarding:complete_tasks', description: 'Complete onboarding tasks' },
  { code: 'recruitment:onboarding:manage_documents', description: 'Manage required onboarding documents' },
  { code: 'recruitment:onboarding:upload_documents', description: 'Upload onboarding documents' },
  { code: 'recruitment:onboarding:verify_documents', description: 'Verify onboarding documents' },
  { code: 'recruitment:onboarding:manage_equipment', description: 'Manage onboarding equipment requirements' },
  { code: 'recruitment:onboarding:assign_equipment', description: 'Assign equipment to new hires' },
  { code: 'recruitment:onboarding:manage_access', description: 'Manage system access provisioning' },
  { code: 'recruitment:onboarding:provision_access', description: 'Provision system access for new hires' },
];

const ROLE_PERM_MAP: Record<string, string[]> = {
  TENANT_ADMIN: [
    'auth:read', 'iam:users:manage', 'iam:roles:manage', 'iam:permissions:manage',
    'iam:legal_entities:manage', 'audit:events:read',
    'employee:read', 'employee:write', 'employment:read', 'employment:write',
    'legal_entity:read', 'legal_entity:write', 'pay_group:read', 'pay_group:write',
    'hr:read',
    'data_import:read', 'data_import:write', 'data_import:approve', 'data_import:publish',
    'payrun:read', 'payrun:create', 'payrun:edit', 'payrun:snapshot', 'payrun:cancel', 'payrun:calculate',
    'payrun:submit', 'payrun:approve', 'payrun:pay', 'payrun:post', 'payrun:finalize',
    'payrun:adjust', 'payrun:trace:read', 'payrun:admin',
    'payroll:calendars:view', 'payroll:calendars:create', 'payroll:calendars:manage',
    'payroll:periods:view', 'payroll:periods:lock', 'payroll:periods:unlock', 'payroll:periods:close', 'payroll:periods:manage',
    'payroll:containers:close', 'payroll:containers:archive',
    'payroll:checklists:view', 'payroll:checklists:create', 'payroll:checklists:complete', 'payroll:checklists:assign',
    'payroll:exceptions:view', 'payroll:exceptions:detect', 'payroll:exceptions:resolve', 'payroll:exceptions:dismiss',
    'payroll:reconciliation:view', 'payroll:reconciliation:create', 'payroll:reconciliation:manage',
    'payroll:forecasts:view', 'payroll:forecasts:create', 'payroll:forecasts:manage',
    'compliance:read', 'compliance:write',
    'tax:read', 'tax:write',
    'tax_table_authoring_view', 'tax_table_authoring_create', 'tax_table_authoring_import', 'tax_table_authoring_edit',
    'tax_table_authoring_submit_approval', 'tax_table_authoring_approve', 'tax_table_authoring_publish', 'tax_table_authoring_archive',
    'tax_table_authoring_audit_view',
    'report:payslip:read', 'report:bankfile:read', 'report:bankfile:generate', 'report:gljournal:read', 'report:summary:read',
    'pay_period:read', 'pay_period:write',
    'sars:tax_periods:read', 'sars:irp5:read', 'sars:irp5:generate', 'sars:irp5:export',
    'sars:emp201:read', 'sars:emp201:generate', 'sars:emp201:export', 'sars:emp201:submit',
    'sars:emp501:read', 'sars:emp501:generate', 'sars:emp501:export', 'sars:emp501:approve',
    'sars:validation:run', 'sars:submission:manage', 'sars:submission:read',
    'payment_batch:read', 'payment_batch:create', 'payment_batch:export',
    'payment_batch:update', 'payment_batch:confirm_paid', 'payment_batch:audit:read',
    'payroll:ctc_optimiser:run', 'payroll:ctc_optimiser:view', 'payroll:ctc_optimiser:apply', 'payroll:ctc_optimiser:approve',
    'recruitment:requisitions:create', 'recruitment:requisitions:view', 'recruitment:requisitions:update',
    'recruitment:requisitions:approve', 'recruitment:requisitions:post', 'recruitment:requisitions:manage',
    'recruitment:candidates:create', 'recruitment:candidates:view',
    'recruitment:applications:create', 'recruitment:applications:view', 'recruitment:applications:manage', 'recruitment:applications:rate',
    'recruitment:interviews:schedule', 'recruitment:interviews:view', 'recruitment:interviews:feedback', 'recruitment:interviews:manage',
    'recruitment:offers:create', 'recruitment:offers:approve', 'recruitment:offers:send', 'recruitment:offers:view',
    'recruitment:onboarding:create', 'recruitment:onboarding:view', 'recruitment:onboarding:complete_tasks',
    'recruitment:onboarding:manage_documents', 'recruitment:onboarding:upload_documents', 'recruitment:onboarding:verify_documents',
    'recruitment:onboarding:manage_equipment', 'recruitment:onboarding:assign_equipment',
    'recruitment:onboarding:manage_access', 'recruitment:onboarding:provision_access',
  ],
  PAYROLL_CLERK: [
    'payrun:read', 'payrun:create', 'payrun:edit', 'payrun:snapshot', 'payrun:cancel', 'payrun:calculate',
    'payrun:submit', 'payrun:adjust', 'payrun:trace:read',
    'employee:read', 'employment:read',
    'compensation:read', 'bank_account:read', 'tax_profile:read',
  ],
  PAYROLL_APPROVER: ['payrun:read', 'payrun:approve', 'payrun:trace:read'],
  FINANCE_APPROVER: [
    'payrun:read', 'payrun:pay', 'payrun:trace:read', 'payrun:post', 'payrun:finalize',
    'compensation:read', 'tax_profile:read',
  ],
  SARS_OFFICER: [
    'sars:tax_periods:read', 'sars:irp5:read', 'sars:irp5:generate', 'sars:irp5:export',
    'sars:emp201:read', 'sars:emp201:generate', 'sars:emp201:export',
    'sars:emp501:read', 'sars:emp501:generate', 'sars:emp501:export',
    'sars:validation:run',
    'tax_profile:read',
  ],
  SARS_APPROVER: [
    'sars:emp201:read', 'sars:emp201:submit', 'sars:submission:manage', 'sars:submission:read',
    'sars:emp501:read', 'sars:emp501:approve',
    'tax_profile:read',
  ],
  AUDITOR_READONLY: [
    'payrun:read', 'payrun:trace:read', 'sars:irp5:read', 'sars:emp201:read', 'sars:emp501:read',
    'audit:events:read',
  ],
  EMPLOYEE_SELF_SERVICE: ['self:payslips:read', 'self:tax:read', 'self:profile:read', 'self:profile:update'],
  INTEGRATION_IGA: ['hr:read'],
  HR_ADMIN: ['employee:read', 'employee:write', 'employment:read', 'employment:write', 'legal_entity:read', 'legal_entity:write', 'pay_group:read', 'hr:read'],
  PAYROLL_PROCESSOR: [
    'payrun:read', 'payrun:create', 'payrun:edit', 'payrun:snapshot', 'payrun:cancel', 'payrun:calculate',
    'payrun:submit', 'payrun:adjust', 'payrun:trace:read',
    'employee:read', 'employment:read', 'compensation:read', 'bank_account:read', 'tax_profile:read',
    'payroll:calendars:view', 'payroll:checklists:view', 'payroll:checklists:complete',
    'payroll:periods:view', 'payroll:exceptions:view', 'payroll:exceptions:resolve', 'payroll:exceptions:dismiss',
    'report:payslip:read', 'report:summary:read',
  ],
  PAYROLL_MANAGER: [
    'payrun:read', 'payrun:create', 'payrun:edit', 'payrun:snapshot', 'payrun:cancel', 'payrun:calculate',
    'payrun:submit', 'payrun:approve', 'payrun:pay', 'payrun:post', 'payrun:finalize',
    'payrun:adjust', 'payrun:readiness_override', 'payrun:financial_override', 'payrun:closed_period_override', 'payrun:trace:read', 'payrun:admin',
    'employee:read', 'employment:read', 'compensation:read', 'bank_account:read', 'tax_profile:read',
    'payroll:calendars:view', 'payroll:calendars:create', 'payroll:calendars:manage',
    'payroll:periods:view', 'payroll:periods:lock', 'payroll:periods:unlock', 'payroll:periods:close', 'payroll:periods:manage',
    'payroll:containers:close', 'payroll:containers:archive',
    'payroll:checklists:view', 'payroll:checklists:create', 'payroll:checklists:complete', 'payroll:checklists:assign',
    'payroll:exceptions:view', 'payroll:exceptions:detect', 'payroll:exceptions:resolve', 'payroll:exceptions:dismiss',
    'payroll:reconciliation:view', 'payroll:forecasts:view',
    'report:payslip:read', 'report:bankfile:read', 'report:bankfile:generate', 'report:gljournal:read', 'report:summary:read',
    'audit:events:read',
    'payment_batch:read', 'payment_batch:create', 'payment_batch:export', 'payment_batch:audit:read',
    'compliance:read', 'compliance:write',
    'payroll:ctc_optimiser:run', 'payroll:ctc_optimiser:view',
  ],
  PAYMENT_OPERATOR: [
    'payrun:read', 'payrun:trace:read', 'payrun:bank_override',
    'report:bankfile:read', 'report:bankfile:generate',
    'payment_batch:read', 'payment_batch:create', 'payment_batch:export',
    'payment_batch:update', 'payment_batch:confirm_paid', 'payment_batch:audit:read',
  ],
  RECONCILIATION_ANALYST: [
    'payrun:read', 'payrun:trace:read',
    'payroll:reconciliation:view', 'payroll:reconciliation:create', 'payroll:reconciliation:manage',
    'report:payslip:read', 'report:summary:read', 'report:gljournal:read',
    'audit:events:read',
  ],
  FINANCE_REVIEWER: [
    'payrun:read', 'payrun:trace:read', 'payrun:gl_override',
    'payroll:reconciliation:view',
    'report:payslip:read', 'report:summary:read', 'report:gljournal:read',
    'payment_batch:read',
  ],
  COMPLIANCE_OFFICER: [
    'payrun:read',
    'sars:tax_periods:read', 'sars:irp5:read', 'sars:irp5:generate', 'sars:irp5:export',
    'sars:emp201:read', 'sars:emp201:generate', 'sars:emp201:export', 'sars:emp201:submit',
    'sars:emp501:read', 'sars:emp501:generate', 'sars:emp501:export', 'sars:emp501:approve',
    'sars:validation:run', 'sars:submission:manage', 'sars:submission:read',
    'compliance:read', 'compliance:write',
    'tax:read', 'tax_profile:read',
    'audit:events:read',
  ],
  TAX_TABLE_ADMINISTRATOR: [
    'tax:read', 'tax:write', 'tax_profile:read',
    'tax_table_authoring_view', 'tax_table_authoring_create', 'tax_table_authoring_import', 'tax_table_authoring_edit',
    'tax_table_authoring_submit_approval', 'tax_table_authoring_approve', 'tax_table_authoring_publish', 'tax_table_authoring_archive',
    'tax_table_authoring_audit_view',
    'audit:events:read',
  ],
  EXECUTIVE_READONLY: [
    'payrun:read',
    'report:summary:read',
    'compliance:read',
    'audit:events:read',
    'payment_batch:read',
  ],
  GLOBAL_PAYROLL_ADMIN: [
    'payrun:read', 'payrun:create', 'payrun:edit', 'payrun:snapshot', 'payrun:cancel', 'payrun:calculate',
    'payrun:submit', 'payrun:approve', 'payrun:pay', 'payrun:post', 'payrun:finalize',
    'payrun:adjust', 'payrun:readiness_override', 'payrun:financial_override', 'payrun:closed_period_override', 'payrun:trace:read', 'payrun:admin',
    'employee:read', 'employment:read', 'compensation:read', 'bank_account:read', 'tax_profile:read',
    'payroll:calendars:view', 'payroll:calendars:create', 'payroll:calendars:manage',
    'payroll:periods:view', 'payroll:periods:lock', 'payroll:periods:unlock', 'payroll:periods:close', 'payroll:periods:manage',
    'payroll:containers:close', 'payroll:containers:archive',
    'payroll:checklists:view', 'payroll:checklists:create', 'payroll:checklists:complete', 'payroll:checklists:assign',
    'payroll:exceptions:view', 'payroll:exceptions:detect', 'payroll:exceptions:resolve', 'payroll:exceptions:dismiss',
    'payroll:reconciliation:view', 'payroll:reconciliation:create', 'payroll:reconciliation:manage',
    'payroll:forecasts:view', 'payroll:forecasts:create', 'payroll:forecasts:manage',
    'report:payslip:read', 'report:bankfile:read', 'report:bankfile:generate', 'report:gljournal:read', 'report:summary:read',
    'audit:events:read',
  ],
  GLOBAL_COMPLIANCE_ADMIN: [
    'sars:tax_periods:read', 'sars:irp5:read', 'sars:irp5:generate', 'sars:irp5:export',
    'sars:emp201:read', 'sars:emp201:generate', 'sars:emp201:export', 'sars:emp201:submit',
    'sars:emp501:read', 'sars:emp501:generate', 'sars:emp501:export', 'sars:emp501:approve',
    'sars:validation:run', 'sars:submission:manage', 'sars:submission:read',
    'compliance:read', 'compliance:write', 'compliance:delete',
    'tax:read', 'tax:write', 'tax_profile:read',
    'tax_table_authoring_view', 'tax_table_authoring_create', 'tax_table_authoring_import', 'tax_table_authoring_edit',
    'tax_table_authoring_submit_approval', 'tax_table_authoring_approve', 'tax_table_authoring_publish', 'tax_table_authoring_archive',
    'tax_table_authoring_audit_view',
    'audit:events:read',
  ],
  TALENT_ADMIN: [
    'recruitment:requisitions:create', 'recruitment:requisitions:view', 'recruitment:requisitions:update',
    'recruitment:requisitions:approve', 'recruitment:requisitions:post', 'recruitment:requisitions:manage',
    'recruitment:candidates:create', 'recruitment:candidates:view',
    'recruitment:applications:create', 'recruitment:applications:view', 'recruitment:applications:manage', 'recruitment:applications:rate',
    'recruitment:interviews:schedule', 'recruitment:interviews:view', 'recruitment:interviews:feedback', 'recruitment:interviews:manage',
    'recruitment:offers:create', 'recruitment:offers:approve', 'recruitment:offers:send', 'recruitment:offers:view',
    'recruitment:onboarding:create', 'recruitment:onboarding:view', 'recruitment:onboarding:complete_tasks',
    'recruitment:onboarding:manage_documents', 'recruitment:onboarding:upload_documents', 'recruitment:onboarding:verify_documents',
    'recruitment:onboarding:manage_equipment', 'recruitment:onboarding:assign_equipment',
    'recruitment:onboarding:manage_access', 'recruitment:onboarding:provision_access',
  ],
  RECRUITER: [
    'recruitment:requisitions:create', 'recruitment:requisitions:view', 'recruitment:requisitions:update',
    'recruitment:candidates:create', 'recruitment:candidates:view',
    'recruitment:applications:create', 'recruitment:applications:view', 'recruitment:applications:manage', 'recruitment:applications:rate',
    'recruitment:interviews:schedule', 'recruitment:interviews:view', 'recruitment:interviews:manage',
    'recruitment:offers:create', 'recruitment:offers:view',
    'recruitment:onboarding:create', 'recruitment:onboarding:view',
    'recruitment:onboarding:manage_documents', 'recruitment:onboarding:upload_documents',
  ],
  HIRING_MANAGER: [
    'recruitment:requisitions:view', 'recruitment:requisitions:approve', 'recruitment:requisitions:post',
    'recruitment:candidates:view',
    'recruitment:applications:view', 'recruitment:applications:manage', 'recruitment:applications:rate',
    'recruitment:interviews:view', 'recruitment:interviews:feedback',
    'recruitment:offers:view', 'recruitment:offers:approve',
    'recruitment:onboarding:view',
  ],
  INTERVIEWER: [
    'recruitment:interviews:view', 'recruitment:interviews:feedback',
  ],
  HR_OPERATIONS: [
    'recruitment:candidates:view', 'recruitment:applications:view',
    'recruitment:interviews:view', 'recruitment:offers:view',
    'recruitment:onboarding:create', 'recruitment:onboarding:view', 'recruitment:onboarding:complete_tasks',
    'recruitment:onboarding:manage_documents', 'recruitment:onboarding:upload_documents', 'recruitment:onboarding:verify_documents',
    'recruitment:onboarding:manage_equipment', 'recruitment:onboarding:assign_equipment',
    'recruitment:onboarding:manage_access', 'recruitment:onboarding:provision_access',
  ],
  PLATFORM_SUPERADMIN: PERMISSIONS.map((p) => p.code),
};

async function main() {
  console.log('🌱 Seeding roles and permissions...\n');

  const roles: Record<string, { id: string }> = {};
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name as any },
      create: { name: r.name as any, description: r.description },
      update: { description: r.description },
    });
    roles[r.name] = { id: role.id };
  }

  const permissions: Record<string, { id: string }> = {};
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      create: { code: p.code, description: p.description },
      update: { description: p.description },
    });
    permissions[p.code] = { id: perm.id };
  }

  for (const [roleName, permCodes] of Object.entries(ROLE_PERM_MAP)) {
    const role = roles[roleName];
    if (!role) continue;
    for (const code of permCodes) {
      const perm = permissions[code];
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
    }
  }

  console.log('✅ Roles and permissions seeded.');
  console.log(`   • ${Object.keys(roles).length} roles`);
  console.log(`   • ${Object.keys(permissions).length} permissions`);

  console.log('\n🌱 Seeding reference data (Pay Items)...');
  let payItemsCount = 0;
  for (const item of PAY_ITEMS) {
    await prisma.payItem.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        name: item.name,
        description: item.description,
        type: item.type as any,
        category: item.category,
        isSystem: item.isSystem,
        sortOrder: item.sortOrder,
      },
      update: {
        name: item.name,
        description: item.description,
        type: item.type as any,
        category: item.category,
        isSystem: item.isSystem,
        sortOrder: item.sortOrder,
      },
    });
    payItemsCount++;
  }
  console.log(`✅ ${payItemsCount} Pay Items seeded.`);

  console.log('\n   Next: npm run bootstrap:admin (customer) or npm run demo:seed (development)\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P1001') {
      const target = process.env.DATABASE_URL
        ? describeDatabaseTargetFromUrl(process.env.DATABASE_URL)
        : '(DATABASE_URL unset)';
      console.error(
        `\nDatabase unreachable (P1001). Seed scripts load .env from the repo root with override (shell DATABASE_URL no longer wins). ` +
          `Effective target from DATABASE_URL: ${target}. Start Postgres (e.g. npm run docker:up).`,
      );
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
