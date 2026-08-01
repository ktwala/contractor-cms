-- Baseline migration: full schema from Prisma schema.prisma (186 models, 63 enums)
-- Generated via: prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- Date: 2026-08-01

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Country" AS ENUM ('LS', 'ZA');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('LSL', 'ZAR');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'TERMINATED', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'CASUAL');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayItemType" AS ENUM ('EARNING', 'DEDUCTION', 'TAX', 'EMPLOYER_CONTRIB');

-- CreateEnum
CREATE TYPE "PayrunFinancialControlStatus" AS ENUM ('MATCH', 'VARIANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PayrunBankReconciliationStatus" AS ENUM ('MATCH', 'VARIANCE', 'REJECTED', 'PARTIAL', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PayrunBankConfirmationSourceType" AS ENUM ('BANK_ACK', 'BANK_RETURN', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayrunGLReconciliationStatus" AS ENUM ('MATCH', 'VARIANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PayrunGLConfirmationSourceType" AS ENUM ('ERP_IMPORT', 'GL_FILE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayRunStatus" AS ENUM ('DRAFT', 'SNAPSHOT', 'CALCULATING', 'CALCULATED', 'IN_REVIEW', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayRunType" AS ENUM ('REGULAR', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PayrollTaxYearStatus" AS ENUM ('PLANNING', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdjustmentMode" AS ENUM ('DELTA_ONLY', 'FULL_RECALC');

-- CreateEnum
CREATE TYPE "PayrunReversalWorkflowStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrunCorrectionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "GovernancePolicyScope" AS ENUM ('GLOBAL', 'LEGAL_ENTITY', 'PAY_GROUP');

-- CreateEnum
CREATE TYPE "GovernancePolicyDraftStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChangeRequestKind" AS ENUM ('EMPLOYEE_BANK_ACCOUNT', 'EMPLOYEE_COMPENSATION', 'EMPLOYEE_TAX_PROFILE', 'PAY_ITEM_MAPPING', 'OTHER');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('PAYRUN_CALCULATE', 'IMPORT_VARIABLE_PAY', 'IMPORT_TAX_TABLES', 'EXPORT_BANK_FILE', 'EXPORT_PAYSLIPS', 'EXPORT_GL_JOURNAL', 'EXPORT_STATUTORY');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('VARIABLE_PAY', 'TAX_TABLES');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('BANK_FILE', 'PAYSLIP_BUNDLE', 'GL_JOURNAL', 'STATUTORY_EXPORT');

-- CreateEnum
CREATE TYPE "PackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "TaxTableType" AS ENUM ('PAYE', 'UIF', 'SDL', 'MTC', 'ETI');

-- CreateEnum
CREATE TYPE "ResidencyStatus" AS ENUM ('RESIDENT', 'NON_RESIDENT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHEQUE', 'SAVINGS', 'CURRENT');

-- CreateEnum
CREATE TYPE "RoundingMode" AS ENUM ('HALF_UP', 'HALF_EVEN', 'DOWN', 'UP');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('PAYROLL_MANAGER', 'APPROVER', 'HR_ADMIN', 'TENANT_ADMIN', 'PAYROLL_CLERK', 'PAYROLL_APPROVER', 'FINANCE_APPROVER', 'SARS_OFFICER', 'SARS_APPROVER', 'AUDITOR', 'AUDITOR_READONLY', 'EMPLOYEE_SELF_SERVICE', 'INTEGRATION_IGA', 'PLATFORM_SUPERADMIN', 'PAYROLL_PROCESSOR', 'PAYMENT_OPERATOR', 'RECONCILIATION_ANALYST', 'FINANCE_REVIEWER', 'COMPLIANCE_OFFICER', 'TAX_TABLE_ADMINISTRATOR', 'EXECUTIVE_READONLY', 'GLOBAL_PAYROLL_ADMIN', 'GLOBAL_COMPLIANCE_ADMIN', 'TALENT_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'HR_OPERATIONS');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'DELEGATED');

-- CreateEnum
CREATE TYPE "ApprovalEntityType" AS ENUM ('PAYRUN', 'CHANGE_REQUEST', 'EMPLOYEE_CHANGE');

-- CreateEnum
CREATE TYPE "RoleScopeType" AS ENUM ('GLOBAL', 'LEGAL_ENTITY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PAYRUN_CREATED', 'PAYRUN_CALCULATED', 'PAYRUN_SUBMITTED', 'PAYRUN_APPROVED', 'PAYRUN_REJECTED', 'PAYRUN_FINALIZED', 'PAYRUN_PAID', 'APPROVAL_REQUIRED', 'APPROVAL_REMINDER', 'APPROVAL_DELEGATED', 'PAY_DATE_REMINDER', 'SUBMISSION_DEADLINE', 'PAYSLIP_AVAILABLE', 'TAX_CERTIFICATE_AVAILABLE', 'IMPORT_COMPLETED', 'IMPORT_FAILED', 'REPORT_READY');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'WEBHOOK', 'IN_APP', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "LeaveTypeCode" AS ENUM ('ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'FAMILY_RESPONSIBILITY', 'STUDY', 'UNPAID', 'COMPASSIONATE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'TAKEN');

-- CreateEnum
CREATE TYPE "LeaveAccrualType" AS ENUM ('MONTHLY', 'ANNUAL', 'OPENING_BALANCE', 'ADJUSTMENT', 'CARRY_OVER', 'FORFEIT', 'ENCASHMENT', 'TERMINATION_PAYOUT');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('IDENTITY', 'EMPLOYMENT', 'QUALIFICATION', 'COMPLIANCE', 'TAX', 'BANKING', 'MEDICAL', 'IMMIGRATION', 'LICENSE', 'PERFORMANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'VERIFIED', 'REJECTED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DataImportDatasetType" AS ENUM ('LEGAL_ENTITIES', 'ORG_UNITS', 'COST_CENTERS', 'EMPLOYEES', 'EMPLOYMENTS', 'EMPLOYMENT_ASSIGNMENTS', 'POSITIONS', 'MANAGER_RELATIONSHIPS', 'PAY_GROUPS', 'PAYROLL_SUPPLEMENTAL', 'PAYROLL_OPENING_BALANCES');

-- CreateEnum
CREATE TYPE "DataImportStatus" AS ENUM ('UPLOADED', 'PARSED', 'VALIDATING', 'VALIDATED', 'HAS_ERRORS', 'APPROVED', 'PUBLISHING', 'PUBLISHED', 'CANCELLING', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "DataImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'PUBLISHED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BootstrapImportStatus" AS ENUM ('UPLOADING', 'DETECTED', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'CANCELLING', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkforceIssueEntityType" AS ENUM ('OVERVIEW', 'LEGAL_ENTITY', 'ORG_UNIT', 'COST_CENTER', 'EMPLOYEE', 'EMPLOYMENT', 'EMPLOYMENT_ASSIGNMENT', 'MANAGER_HIERARCHY', 'IMPORT_JOB', 'HR_EXPORT');

-- CreateEnum
CREATE TYPE "WorkforceIssueType" AS ENUM ('MISSING_MANAGER', 'MISSING_ORG_ASSIGNMENT', 'MISSING_COST_CENTER', 'MISSING_LEGAL_ENTITY', 'MISSING_PAY_GROUP', 'MISSING_HIRE_DATE', 'ORPHAN_ASSIGNMENT', 'INVALID_ASSIGNMENT_DATE_RANGE', 'MULTIPLE_ACTIVE_ASSIGNMENTS', 'ORG_UNIT_WITHOUT_EMPLOYEES', 'ORG_UNIT_WITHOUT_MANAGER', 'COST_CENTER_UNUSED', 'COST_CENTER_UNLINKED', 'EMPLOYEE_WITHOUT_EMPLOYMENT', 'EMPLOYEE_WITHOUT_ASSIGNMENT', 'EMPLOYEE_EXPORT_BLOCKED', 'MANAGER_CHAIN_INCOMPLETE', 'MANAGER_SELF_REFERENCE', 'HIERARCHY_CYCLE_RISK', 'DATA_IMPORT_VALIDATION_FAILURE', 'HR_EXPORT_BLOCKER');

-- CreateEnum
CREATE TYPE "WorkforceIssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReadinessEntityType" AS ENUM ('OVERVIEW', 'LEGAL_ENTITY', 'ORG_UNIT', 'COST_CENTER', 'HR_EXPORT');

-- CreateEnum
CREATE TYPE "ReadinessStatus" AS ENUM ('READY', 'WARNING', 'BLOCKED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "CostCenterUsageStatus" AS ENUM ('ACTIVE', 'LOW_USAGE', 'UNUSED', 'PARTIALLY_MAPPED', 'WARNING');

-- CreateEnum
CREATE TYPE "HierarchyRole" AS ENUM ('NORMAL', 'TOP_OF_CHAIN');

-- CreateEnum
CREATE TYPE "ManagerAssignmentSource" AS ENUM ('MANUAL', 'IMPORT', 'INFERRED_ACCEPTED');

-- CreateEnum
CREATE TYPE "OrgManagerSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'STALE');

-- CreateEnum
CREATE TYPE "RemediationApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "PayrunExceptionType" AS ENUM ('MISSING_BANK_DETAILS', 'MISSING_TAX_NUMBER', 'MISSING_PAY_INPUT', 'NEGATIVE_NET_PAY', 'ZERO_NET_PAY_UNEXPECTED', 'INVALID_DEDUCTION_TOTAL', 'OVERTIME_THRESHOLD_BREACH', 'INACTIVE_EMPLOYEE_INCLUDED', 'TERMINATED_EMPLOYEE_INCLUDED', 'DUPLICATE_EMPLOYEE_IN_RUN', 'MISSING_EMPLOYMENT_ASSIGNMENT', 'MISSING_PAY_GROUP_MAPPING', 'CALCULATION_ANOMALY', 'UNUSUAL_VARIANCE', 'PAYMENT_DATE_MISMATCH', 'RUN_CONFIGURATION_WARNING', 'MISSING_TAX_PROFILE', 'MISSING_BANK_VERIFICATION', 'MISSING_IDENTIFICATION', 'ON_LEAVE_EMPLOYEE_INCLUDED', 'DEDUCTIONS_EXCEED_GROSS');

-- CreateEnum
CREATE TYPE "PayrunExceptionSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "PayrunExceptionStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PayrunExceptionResolutionType" AS ENUM ('DATA_FIXED', 'ACCEPTED_WITH_JUSTIFICATION', 'NOT_APPLICABLE', 'MANUAL_OVERRIDE_APPROVED');

-- CreateEnum
CREATE TYPE "DetectedByType" AS ENUM ('SYSTEM', 'USER', 'RULE_ENGINE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "user_legal_entity_access" (
    "user_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_legal_entity_access_pkey" PRIMARY KEY ("user_id","legal_entity_id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "scope_type" "RoleScopeType" NOT NULL DEFAULT 'LEGAL_ENTITY',
    "legal_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "registration_no" TEXT,
    "tax_reference" TEXT,
    "address" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_locations" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country_code" TEXT,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "is_hybrid" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_units" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_org_unit_id" TEXT,
    "manager_employee_id" TEXT,
    "manager_assignment_source" "ManagerAssignmentSource",
    "manager_assignment_confidence" INTEGER,
    "manager_assignment_updated_at" TIMESTAMP(3),
    "manager_assignment_updated_by_user_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "org_unit_id" TEXT NOT NULL,
    "position_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "default_cost_center_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_groups" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "currency" "Currency" NOT NULL,
    "frequency" "PayFrequency" NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "default_calendar" JSONB,
    "gl_defaults" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "pay_group_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tax_year_start" DATE NOT NULL,
    "tax_year_end" DATE NOT NULL,
    "status" "PayrollTaxYearStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_governance_policies" (
    "id" TEXT NOT NULL,
    "policy_key" TEXT NOT NULL,
    "scope" "GovernancePolicyScope" NOT NULL,
    "legal_entity_id" TEXT,
    "pay_group_id" TEXT,
    "current_value" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "changed_by_user_id" TEXT NOT NULL,
    "approval_reference" TEXT,
    "superseded_by_policy_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_governance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_governance_policy_drafts" (
    "id" TEXT NOT NULL,
    "policy_key" TEXT NOT NULL,
    "scope" "GovernancePolicyScope" NOT NULL,
    "legal_entity_id" TEXT,
    "pay_group_id" TEXT,
    "proposed_value" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "impact_preview_hash" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "status" "GovernancePolicyDraftStatus" NOT NULL,
    "activation_policy_id" TEXT,
    "approval_reference" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_governance_policy_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_periods" (
    "id" TEXT NOT NULL,
    "pay_group_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "pay_date" DATE NOT NULL,
    "cutoff_date" DATE,
    "year" INTEGER NOT NULL,
    "period_num" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "closed_by_user_id" TEXT,
    "payroll_id" TEXT,

    CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employee_no" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "national_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "date_of_birth" DATE,
    "id_type" TEXT,
    "id_number" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "hire_date" DATE NOT NULL,
    "termination_date" DATE,
    "end_date" DATE,
    "user_id" TEXT,
    "salary" DECIMAL(15,2),
    "department" TEXT,
    "job_title" TEXT,
    "manager_id" TEXT,
    "hierarchy_role" "HierarchyRole" NOT NULL DEFAULT 'NORMAL',
    "profile_picture_url" TEXT,
    "country" "Country",
    "legal_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "pay_group_id" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "job_title" TEXT,
    "cost_center" TEXT,
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_assignments" (
    "id" TEXT NOT NULL,
    "employment_id" TEXT NOT NULL,
    "org_unit_id" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "position_id" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensations" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "base_salary" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number_enc" TEXT NOT NULL,
    "masked_account_number" TEXT NOT NULL,
    "branch_code" TEXT,
    "account_type" "AccountType",
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_profiles" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "residency_status" "ResidencyStatus" NOT NULL,
    "tin" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PayItemType" NOT NULL,
    "category" TEXT,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "gl_account" TEXT,
    "gl_account_credit" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "formula" TEXT,
    "formula_deps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "country_attributes" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "pay_group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" "Country",
    "expression" TEXT NOT NULL,
    "dependencies" TEXT[],
    "rounding" JSONB,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_registry" (
    "id" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "pack_version" TEXT NOT NULL,
    "display_name" TEXT,
    "description" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "PackStatus" NOT NULL DEFAULT 'DRAFT',
    "artifact_checksum" TEXT,
    "release_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "pack_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_table_sets" (
    "id" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "table_type" "TaxTableType" NOT NULL,
    "tax_year" TEXT NOT NULL,
    "display_name" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "PackStatus" NOT NULL DEFAULT 'DRAFT',
    "source_ref" TEXT,
    "checksum" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "tax_table_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_configs" (
    "id" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "config_type" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "PackStatus" NOT NULL DEFAULT 'DRAFT',
    "checksum" TEXT,
    "data" JSONB NOT NULL,
    "source_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statutory_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_tables" (
    "id" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_brackets" (
    "id" TEXT NOT NULL,
    "tax_table_id" TEXT NOT NULL,
    "from_amount" DECIMAL(18,2) NOT NULL,
    "to_amount" DECIMAL(18,2),
    "rate" DECIMAL(10,6) NOT NULL,
    "base_tax" DECIMAL(18,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tax_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payruns" (
    "id" TEXT NOT NULL,
    "pay_group_id" TEXT NOT NULL,
    "period_id" TEXT,
    "period_start" DATE,
    "period_end" DATE,
    "pay_date" DATE,
    "status" "PayRunStatus" NOT NULL DEFAULT 'DRAFT',
    "payrun_type" "PayRunType" NOT NULL DEFAULT 'REGULAR',
    "base_payrun_id" TEXT,
    "adjustment_reason" TEXT,
    "adjustment_mode" "AdjustmentMode",
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "submitted_by_user_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_by_user_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "posted_by_user_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "finalized_by_user_id" TEXT,
    "finalized_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "last_calculated_at" TIMESTAMP(3),
    "snapshot_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "financial_control_impacted" BOOLEAN NOT NULL DEFAULT false,
    "bank_reconciliation_impacted" BOOLEAN NOT NULL DEFAULT false,
    "gl_reconciliation_impacted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "payruns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrun_reversal_workflows" (
    "id" TEXT NOT NULL,
    "source_payrun_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "initiated_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "status" "PayrunReversalWorkflowStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reversal_payrun_id" TEXT,
    "audit_chain" JSONB,
    "downstream_reconciliation_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_reversal_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrun_correction_approvals" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "requested_change_scope" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "approver_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_reference" TEXT NOT NULL,
    "resulting_adjustment_payrun_id" TEXT,
    "status" "PayrunCorrectionApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "downstream_reconciliation_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_correction_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrun_contexts" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "currency" "Currency" NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "pack_version" TEXT NOT NULL,
    "pack_registry_id" TEXT,
    "tax_table_set_id" TEXT,
    "tax_table" JSONB NOT NULL,
    "rounding_policy" JSONB,
    "routing_snapshot" JSONB,
    "checksums" JSONB,
    "compute_date_rule" TEXT,
    "compute_date_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payrun_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrun_employees" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "exclude_note" TEXT,
    "snapshot_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payrun_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_item_inputs" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "pay_item_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_item_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_inputs" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "pay_item_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "meta" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_results" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "gross" DECIMAL(18,2) NOT NULL,
    "taxable_income" DECIMAL(18,2) NOT NULL,
    "paye" DECIMAL(18,2) NOT NULL,
    "deductions_total" DECIMAL(18,2) NOT NULL,
    "net" DECIMAL(18,2) NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL,
    "calc_trace" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_lines" (
    "id" TEXT NOT NULL,
    "employee_result_id" TEXT NOT NULL,
    "pay_item_id" TEXT NOT NULL,
    "type" "PayItemType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "kind" "ChangeRequestKind" NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "subject_entity_type" TEXT NOT NULL,
    "subject_entity_id" TEXT NOT NULL,
    "country" "Country",
    "legal_entity_id" TEXT,
    "requested_effective_from" DATE,
    "requested_effective_to" DATE,
    "reason" TEXT,
    "payload" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "applied_entity_type" TEXT,
    "applied_entity_id" TEXT,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT,
    "kind" "ImportKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "filename" TEXT,
    "summary" JSONB,
    "errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "filename" TEXT,
    "content_type" TEXT,
    "size_bytes" INTEGER,
    "checksum_sha256" TEXT,
    "storage_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "payrun_id" TEXT,
    "artifact_id" TEXT,
    "import_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entity_type" "ApprovalEntityType" NOT NULL,
    "legal_entity_id" TEXT,
    "pay_group_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_levels" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "level_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "approver_user_id" TEXT,
    "approver_role_id" TEXT,
    "can_delegate" BOOLEAN NOT NULL DEFAULT true,
    "auto_approve_after_hours" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_instances" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "entity_type" "ApprovalEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "level_order" INTEGER NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to" TEXT NOT NULL,
    "delegated_to" TEXT,
    "delegated_at" TIMESTAMP(3),
    "delegation_note" TEXT,
    "acted_by" TEXT,
    "acted_at" TIMESTAMP(3),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_delegations" (
    "id" TEXT NOT NULL,
    "delegator_id" TEXT NOT NULL,
    "delegate_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_groups" (
    "id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "group_code" TEXT NOT NULL,
    "consolidation_currency" "Currency" NOT NULL DEFAULT 'ZAR',
    "parent_group_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "consolidation_percentage" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "cost_center_code" TEXT NOT NULL,
    "cost_center_name" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "parent_cost_center_id" TEXT,
    "department_id" TEXT,
    "manager_id" TEXT,
    "cost_type" TEXT NOT NULL DEFAULT 'department',
    "gl_account" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_certificates" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "tax_year" TEXT NOT NULL,
    "certificate_type" TEXT NOT NULL,
    "certificate_number" TEXT,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "employment_start" DATE NOT NULL,
    "employment_end" DATE,
    "periods_worked" INTEGER NOT NULL DEFAULT 0,
    "gross_remuneration" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gross_non_taxable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_income" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paye_deducted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "uif_employee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pension_fund" DECIMAL(15,2),
    "retirement_annuity" DECIMAL(15,2),
    "medical_aid" DECIMAL(15,2),
    "travel_allowance" DECIMAL(15,2),
    "travel_reimbursive" DECIMAL(15,2),
    "other_deductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_income" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submitted_to_sars" BOOLEAN NOT NULL DEFAULT false,
    "sars_submission_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "channel" "DeliveryChannel" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" "NotificationType"[] DEFAULT ARRAY[]::"NotificationType"[],
    "headers" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "response" JSONB,
    "status_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "accounting_system" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "fieldMappings" JSONB NOT NULL DEFAULT '[]',
    "webhook_events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ip_whitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_succeeded" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response_status" INTEGER NOT NULL DEFAULT 0,
    "response_body" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_journals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payrun_id" TEXT,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "journal_date" DATE NOT NULL,
    "posting_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMP(3),
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_journal_lines" (
    "id" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payrun_id" TEXT,
    "reference" TEXT NOT NULL,
    "bank_file_format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payment_count" INTEGER NOT NULL DEFAULT 0,
    "country_code" TEXT,
    "legal_entity_id" TEXT,
    "pay_group_id" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'ZAR',
    "export_status" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "export_generated_at" TIMESTAMP(3),
    "exported_by_user_id" TEXT,
    "confirmed_paid_at" TIMESTAMP(3),
    "confirmed_paid_by_user_id" TEXT,
    "confirmation_note" TEXT,
    "generated_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "reference" TEXT NOT NULL,
    "bank_name" TEXT,
    "account_number" TEXT,
    "branch_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrun_financial_controls" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "payment_batch_id" TEXT,
    "employee_count_register" INTEGER NOT NULL,
    "employee_count_export" INTEGER NOT NULL,
    "total_net_register" DECIMAL(18,2) NOT NULL,
    "total_net_export" DECIMAL(18,2) NOT NULL,
    "variance_amount" DECIMAL(18,4) NOT NULL,
    "variance_employee_count" INTEGER NOT NULL,
    "status" "PayrunFinancialControlStatus" NOT NULL,
    "threshold_policy" TEXT NOT NULL DEFAULT 'DEFAULT_ZAR_0_05',
    "review_required" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "soft_warnings_json" JSONB,
    "blocked_reasons_json" JSONB,
    "reconciled_at" TIMESTAMP(3),
    "reconciled_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_financial_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrun_bank_reconciliations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "payment_batch_id" TEXT NOT NULL,
    "bank_file_reference" TEXT NOT NULL,
    "bank_file_hash" TEXT,
    "export_total" DECIMAL(18,2) NOT NULL,
    "bank_confirmed_total" DECIMAL(18,2) NOT NULL,
    "export_employee_count" INTEGER NOT NULL,
    "bank_confirmed_employee_count" INTEGER NOT NULL,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "partial_count" INTEGER NOT NULL DEFAULT 0,
    "variance_amount" DECIMAL(18,4) NOT NULL,
    "status" "PayrunBankReconciliationStatus" NOT NULL,
    "source_type" "PayrunBankConfirmationSourceType" NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "review_required" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "soft_warnings_json" JSONB,
    "blocked_reasons_json" JSONB,
    "imported_by_user_id" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrun_gl_reconciliations" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "gl_batch_reference" TEXT NOT NULL,
    "gl_posting_hash" TEXT,
    "register_gross" DECIMAL(18,2) NOT NULL,
    "register_net" DECIMAL(18,2) NOT NULL,
    "register_paye" DECIMAL(18,2) NOT NULL,
    "register_deductions" DECIMAL(18,2) NOT NULL,
    "gl_gross" DECIMAL(18,2) NOT NULL,
    "gl_net" DECIMAL(18,2) NOT NULL,
    "gl_paye" DECIMAL(18,2) NOT NULL,
    "gl_deductions" DECIMAL(18,2) NOT NULL,
    "variance_amount" DECIMAL(18,4) NOT NULL,
    "variance_dimensions_json" JSONB,
    "status" "PayrunGLReconciliationStatus" NOT NULL,
    "review_required" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "source_type" "PayrunGLConfirmationSourceType" NOT NULL,
    "soft_warnings_json" JSONB,
    "blocked_reasons_json" JSONB,
    "imported_by_user_id" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_gl_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "country" "Country" NOT NULL,
    "code" "LeaveTypeCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "default_entitlement" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "entitlement_unit" TEXT NOT NULL DEFAULT 'DAYS',
    "accrual_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "accrual_frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "qualifying_months" INTEGER NOT NULL DEFAULT 0,
    "cycle_type" TEXT NOT NULL DEFAULT 'CALENDAR_YEAR',
    "cycle_length_years" INTEGER NOT NULL DEFAULT 1,
    "allow_carry_over" BOOLEAN NOT NULL DEFAULT true,
    "max_carry_over_days" DECIMAL(5,2),
    "carry_over_expiry_months" INTEGER,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "paid_percentage" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "payout_on_termination" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "requires_certificate" BOOLEAN NOT NULL DEFAULT false,
    "certificate_after_days" INTEGER,
    "min_notice_days" INTEGER NOT NULL DEFAULT 0,
    "max_consecutive_days" INTEGER,
    "min_request_days" DECIMAL(3,1) NOT NULL DEFAULT 0.5,
    "allow_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "max_negative_days" DECIMAL(5,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_statutory" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "cycle_start_date" DATE NOT NULL,
    "cycle_end_date" DATE NOT NULL,
    "opening_balance" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "taken" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "pending" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "forfeited" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "encashed" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "available_balance" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "carry_over_balance" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "carry_over_expires_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_half" TEXT,
    "end_half" TEXT,
    "total_days" DECIMAL(5,2) NOT NULL,
    "total_hours" DECIMAL(7,2),
    "reason" TEXT,
    "notes" TEXT,
    "certificate_required" BOOLEAN NOT NULL DEFAULT false,
    "certificate_uploaded" BOOLEAN NOT NULL DEFAULT false,
    "certificate_url" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_by" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "review_comment" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancel_reason" TEXT,
    "affects_payroll" BOOLEAN NOT NULL DEFAULT false,
    "payrun_id" TEXT,
    "deduction_amount" DECIMAL(15,2),
    "paid_amount" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_accruals" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "accrual_date" DATE NOT NULL,
    "accrual_type" "LeaveAccrualType" NOT NULL,
    "amount" DECIMAL(7,2) NOT NULL,
    "balance_before" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "balance_after" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "pay_period_id" TEXT,
    "leave_request_id" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "leave_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pay_group_id" TEXT,
    "leave_type_id" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "entitlement_days" DECIMAL(5,2),
    "accrual_rate" DECIMAL(5,2),
    "service_tiers" JSONB,
    "employment_type_rules" JSONB,
    "additional_rules" JSONB,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "year" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "local_name" TEXT,
    "observed_date" DATE,
    "is_national" BOOLEAN NOT NULL DEFAULT true,
    "region" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "requires_expiry" BOOLEAN NOT NULL DEFAULT false,
    "requires_verification" BOOLEAN NOT NULL DEFAULT true,
    "default_expiry_months" INTEGER,
    "expiry_warning_days" INTEGER NOT NULL DEFAULT 30,
    "expiry_reminder_days" INTEGER[] DEFAULT ARRAY[30, 14, 7]::INTEGER[],
    "allowed_mime_types" TEXT[] DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[],
    "max_file_size_mb" INTEGER NOT NULL DEFAULT 10,
    "retention_years" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "document_type_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "storage_provider" TEXT NOT NULL DEFAULT 'local',
    "title" TEXT,
    "description" TEXT,
    "document_number" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE,
    "issuing_authority" TEXT,
    "country" "Country",
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_latest_version" BOOLEAN NOT NULL DEFAULT true,
    "previous_version_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verification_notes" TEXT,
    "rejection_reason" TEXT,
    "checksum_sha256" TEXT,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "encryption_key_id" TEXT,
    "is_confidential" BOOLEAN NOT NULL DEFAULT false,
    "visible_to_employee" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_logs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_expiry_alerts" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "alert_date" DATE NOT NULL,
    "days_before_expiry" INTEGER NOT NULL,
    "alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "notification_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_expiry_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "document_type_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE,
    "reason" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fulfilled_at" TIMESTAMP(3),
    "document_id" TEXT,
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_reconciliations" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "comparison_period_id" TEXT NOT NULL,
    "reconciliation_type" TEXT NOT NULL DEFAULT 'period_over_period',
    "total_variance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "variance_percentage" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reconciled_by" TEXT NOT NULL,
    "reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_reconciliation_items" (
    "id" TEXT NOT NULL,
    "reconciliation_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "current_value" DECIMAL(18,2) NOT NULL,
    "comparison_value" DECIMAL(18,2) NOT NULL,
    "variance_amount" DECIMAL(18,2) NOT NULL,
    "variance_percentage" DECIMAL(10,4) NOT NULL,
    "explanation" TEXT,
    "is_explained" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_reconciliation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_exceptions" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "exception_type" TEXT NOT NULL,
    "exception_category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT NOT NULL,
    "expected_value" DECIMAL(18,2),
    "actual_value" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "dismissed_by" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "dismiss_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_forecasts" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "forecast_name" TEXT NOT NULL,
    "forecast_type" TEXT NOT NULL,
    "forecast_period_start" DATE NOT NULL,
    "forecast_period_end" DATE NOT NULL,
    "base_period_id" TEXT,
    "forecast_method" TEXT NOT NULL,
    "assumptions" JSONB,
    "total_forecast_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_actual_amount" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_forecast_items" (
    "id" TEXT NOT NULL,
    "forecast_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "forecast_amount" DECIMAL(18,2) NOT NULL,
    "actual_amount" DECIMAL(18,2),
    "variance_amount" DECIMAL(18,2),
    "variance_percentage" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_forecast_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_checklist_templates" (
    "id" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_checklist_template_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "task_description" TEXT,
    "task_category" TEXT NOT NULL,
    "task_order" INTEGER NOT NULL,
    "due_offset_days" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_checklists" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "template_id" TEXT,
    "checklist_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total_tasks" INTEGER NOT NULL DEFAULT 0,
    "completed_tasks" INTEGER NOT NULL DEFAULT 0,
    "completion_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_checklist_tasks" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "task_description" TEXT,
    "task_category" TEXT NOT NULL,
    "task_order" INTEGER NOT NULL,
    "due_date" DATE,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_to" TEXT,
    "completed_by" TEXT,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_checklist_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "benefit_type" TEXT NOT NULL,
    "provider_name" TEXT,
    "provider_code" TEXT,
    "description" TEXT,
    "is_statutory" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allows_dependents" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "tax_treatment" TEXT NOT NULL DEFAULT 'taxable',
    "effective_date" DATE NOT NULL,
    "end_date" DATE,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_plan_options" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "option_name" TEXT NOT NULL,
    "option_code" TEXT,
    "coverage_level" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_plan_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_rates" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "option_id" TEXT,
    "rate_type" TEXT NOT NULL,
    "employee_amount" DECIMAL(18,2),
    "employer_amount" DECIMAL(18,2),
    "employee_percentage" DECIMAL(10,4),
    "employer_percentage" DECIMAL(10,4),
    "min_income" DECIMAL(18,2),
    "max_income" DECIMAL(18,2),
    "min_age" INTEGER,
    "max_age" INTEGER,
    "family_size" INTEGER,
    "monthly_cap" DECIMAL(18,2),
    "annual_cap" DECIMAL(18,2),
    "effective_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_benefits" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "option_id" TEXT,
    "enrollment_date" DATE NOT NULL,
    "effective_date" DATE NOT NULL,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "member_number" TEXT,
    "employee_contribution" DECIMAL(18,2) NOT NULL,
    "employer_contribution" DECIMAL(18,2) NOT NULL,
    "total_contribution" DECIMAL(18,2) NOT NULL,
    "is_custom_rate" BOOLEAN NOT NULL DEFAULT false,
    "custom_rate_reason" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "documents_verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_deductions" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "payslip_id" TEXT,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "employee_deduction" DECIMAL(18,2) NOT NULL,
    "employer_contribution" DECIMAL(18,2) NOT NULL,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "is_prorated" BOOLEAN NOT NULL DEFAULT false,
    "prorata_factor" DECIMAL(10,4),
    "calculation_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_enrollment_history" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "benefit_enrollment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uif_declarations" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "declaration_period" TEXT NOT NULL,
    "total_employees" INTEGER NOT NULL DEFAULT 0,
    "total_remuneration" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_uif_contribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employer_contribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employee_contribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "uif_reference_number" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uif_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uif_declaration_lines" (
    "id" TEXT NOT NULL,
    "declaration_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "id_number" TEXT,
    "remuneration" DECIMAL(18,2) NOT NULL,
    "uif_remuneration" DECIMAL(18,2) NOT NULL,
    "employer_contribution" DECIMAL(18,2) NOT NULL,
    "employee_contribution" DECIMAL(18,2) NOT NULL,
    "total_contribution" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uif_declaration_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdl_declarations" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "declaration_period" TEXT NOT NULL,
    "total_employees" INTEGER NOT NULL DEFAULT 0,
    "total_remuneration" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "leviable_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sdl_levy" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_exempt" BOOLEAN NOT NULL DEFAULT false,
    "exemption_reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payment_reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sdl_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdl_declaration_lines" (
    "id" TEXT NOT NULL,
    "declaration_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "remuneration" DECIMAL(18,2) NOT NULL,
    "leviable_amount" DECIMAL(18,2) NOT NULL,
    "sdl_levy" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sdl_declaration_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coida_assessments" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "assessment_year" INTEGER NOT NULL,
    "risk_class" TEXT NOT NULL,
    "tariff_rate" DECIMAL(10,4) NOT NULL,
    "total_employees" INTEGER NOT NULL DEFAULT 0,
    "total_remuneration" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_assessment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payment_reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coida_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coida_assessment_lines" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "remuneration" DECIMAL(18,2) NOT NULL,
    "assessment" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coida_assessment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_notifications" (
    "id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "document_type" TEXT,
    "document_id" TEXT,
    "has_attachment" BOOLEAN NOT NULL DEFAULT false,
    "attachment_path" TEXT,
    "attachment_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_notifications" (
    "id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "recipient_name" TEXT,
    "message" TEXT NOT NULL,
    "document_type" TEXT,
    "document_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "provider_message_id" TEXT,
    "provider_status" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "device_name" TEXT,
    "device_model" TEXT,
    "os_version" TEXT,
    "app_version" TEXT,
    "push_token" TEXT,
    "push_provider" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "provider" TEXT NOT NULL DEFAULT 'fcm',
    "provider_message_id" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_notifications" (
    "id" TEXT NOT NULL,
    "workflow_type" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "workflow_status" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "recipient_id" TEXT NOT NULL,
    "recipient_email" TEXT,
    "recipient_phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action_required" BOOLEAN NOT NULL DEFAULT false,
    "action_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "sent_via_email" BOOLEAN NOT NULL DEFAULT false,
    "sent_via_sms" BOOLEAN NOT NULL DEFAULT false,
    "sent_via_in_app" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "read_at" TIMESTAMP(3),
    "actioned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action_url" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_schedules" (
    "id" TEXT NOT NULL,
    "alert_name" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_value" TEXT,
    "cron_expression" TEXT,
    "send_email" BOOLEAN NOT NULL DEFAULT true,
    "send_sms" BOOLEAN NOT NULL DEFAULT false,
    "send_in_app" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "report_name" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "recipient_ids" JSONB NOT NULL,
    "parameters" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_run_status" TEXT,
    "last_run_error" TEXT,
    "next_run_at" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient_id" TEXT,
    "recipient_email" TEXT,
    "recipient_phone" TEXT,
    "subject" TEXT,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_periods" (
    "id" TEXT NOT NULL,
    "tax_year" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "month_number" INTEGER,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "submission_due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "irp5_certificates" (
    "id" TEXT NOT NULL,
    "tax_period_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "employee_number" TEXT NOT NULL,
    "id_number" TEXT,
    "passport_number" TEXT,
    "initials" TEXT,
    "surname" TEXT,
    "first_names" TEXT,
    "date_of_birth" DATE,
    "nature_of_person" TEXT,
    "income_from_employment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "travel_allowance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "other_allowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paye_deducted" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "uif_deducted" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sdl_deducted" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pension_fund_contributions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "medical_aid_contributions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "uif_employer" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pension_fund_employer" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "medical_aid_employer" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "medical_aid_name" TEXT,
    "medical_aid_number" TEXT,
    "total_remuneration" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxable_income" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "certificate_number" TEXT NOT NULL,
    "issue_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "irp5_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emp201_returns" (
    "id" TEXT NOT NULL,
    "tax_period_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "employer_paye_number" TEXT,
    "employer_tax_number" TEXT,
    "employer_name" TEXT,
    "employer_trading_name" TEXT,
    "tax_year" TEXT NOT NULL,
    "month_number" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "submission_due_date" DATE,
    "total_employees" INTEGER NOT NULL DEFAULT 0,
    "local_employees" INTEGER NOT NULL DEFAULT 0,
    "foreign_employees" INTEGER NOT NULL DEFAULT 0,
    "paye_current_month" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paye_adjustments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paye_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sdl_current_month" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sdl_adjustments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sdl_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "uif_employee_current" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "uif_employer_current" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "uif_adjustments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "uif_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "eti_current_month" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "eti_adjustments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "eti_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_liability" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "country" TEXT NOT NULL DEFAULT 'ZAF',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "generated_by_user_id" TEXT,
    "generated_at" TIMESTAMP(3),
    "submitted_by_user_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "sars_reference_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emp201_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emp501_reconciliations" (
    "id" TEXT NOT NULL,
    "tax_period_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "tax_year" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total_employees" INTEGER NOT NULL DEFAULT 0,
    "total_liability" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_paye" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_uif" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_sdl" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "irp5_count" INTEGER NOT NULL DEFAULT 0,
    "emp201_count" INTEGER NOT NULL DEFAULT 0,
    "discrepancies" JSONB,
    "generated_by_user_id" TEXT,
    "generated_at" TIMESTAMP(3),
    "submitted_by_user_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "reconciled_by" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emp501_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sars_validation_rules" (
    "id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "rule_name" TEXT NOT NULL,
    "rule_description" TEXT,
    "applies_to" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "validation_logic" JSONB,
    "error_message" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sars_validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sars_validation_results" (
    "id" TEXT NOT NULL,
    "validation_run_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "severity" TEXT NOT NULL,
    "error_message" TEXT,
    "field_name" TEXT,
    "expected_value" TEXT,
    "actual_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sars_validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sars_submissions" (
    "id" TEXT NOT NULL,
    "submission_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "submission_method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sars_reference" TEXT,
    "response_message" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sars_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sars_submission_queue" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "queued_by" TEXT NOT NULL,
    "processing_started_at" TIMESTAMP(3),
    "processing_completed_at" TIMESTAMP(3),
    "sars_reference_number" TEXT,
    "submission_result" JSONB,
    "error_message" TEXT,
    "last_error_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sars_submission_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "resume_url" TEXT,
    "linkedin_url" TEXT,
    "source" TEXT,
    "skills" JSONB,
    "experience" JSONB,
    "education" JSONB,
    "current_salary" DECIMAL(15,2),
    "expected_salary" DECIMAL(15,2),
    "notice_period" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_requisitions" (
    "id" TEXT NOT NULL,
    "requisition_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "legal_entity_id" TEXT,
    "hiring_manager_id" TEXT,
    "description" TEXT,
    "requirements" JSONB,
    "responsibilities" JSONB,
    "salary_min" DECIMAL(15,2),
    "salary_max" DECIMAL(15,2),
    "employment_type" TEXT,
    "location" TEXT,
    "work_location_id" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "hybrid" BOOLEAN NOT NULL DEFAULT false,
    "positions" INTEGER NOT NULL DEFAULT 1,
    "filled_positions" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "closing_date" TIMESTAMP(3),
    "created_by" TEXT,
    "country" "Country",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "application_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "stage" TEXT NOT NULL DEFAULT 'applied',
    "rating" INTEGER,
    "notes" TEXT,
    "rejection_reason" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "application_id" TEXT,
    "interview_type" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "scheduled_time" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT,
    "meeting_link" TEXT,
    "interviewer_ids" JSONB,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "overall_rating" INTEGER,
    "recommendation" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_feedback" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "interviewer_id" TEXT NOT NULL,
    "overall_rating" INTEGER,
    "technical_rating" INTEGER,
    "culture_fit_rating" INTEGER,
    "communication_rating" INTEGER,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "recommendation" TEXT,
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_offers" (
    "id" TEXT NOT NULL,
    "offer_number" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "base_salary" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "bonus" DECIMAL(15,2),
    "benefits" JSONB,
    "start_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "notes" TEXT,
    "offer_letter_url" TEXT,
    "created_by" TEXT,
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_workflows" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "workflow_name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "target_end_date" TIMESTAMP(3),
    "actual_end_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "assigned_to" TEXT,
    "notes" TEXT,
    "country" "Country",
    "legal_entity_id" TEXT,
    "source_offer_id" TEXT,
    "source_candidate_id" TEXT,
    "source_requisition_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "assigned_to" TEXT,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "dependencies" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_documents" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "file_url" TEXT,
    "uploaded_at" TIMESTAMP(3),
    "uploaded_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "shift_name" TEXT NOT NULL,
    "shift_code" TEXT,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_duration_minutes" INTEGER NOT NULL DEFAULT 0,
    "break_paid" BOOLEAN NOT NULL DEFAULT false,
    "shift_type" TEXT NOT NULL DEFAULT 'regular',
    "total_hours" DECIMAL(5,2),
    "overtime_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    "late_grace_period" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "country" "Country",
    "legal_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "work_date" TIMESTAMP(3),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "work_days" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "shift_assignment_id" TEXT,
    "attendance_date" TIMESTAMP(3),
    "work_date" TIMESTAMP(3),
    "clock_in_time" TIMESTAMP(3),
    "clock_out_time" TIMESTAMP(3),
    "clock_in_location" TEXT,
    "clock_out_location" TEXT,
    "clock_in_ip" TEXT,
    "clock_out_ip" TEXT,
    "clock_in_latitude" DECIMAL(10,8),
    "clock_in_longitude" DECIMAL(11,8),
    "clock_in_accuracy" DECIMAL(10,2),
    "clock_out_latitude" DECIMAL(10,8),
    "clock_out_longitude" DECIMAL(11,8),
    "clock_out_accuracy" DECIMAL(10,2),
    "clock_in_device_id" TEXT,
    "clock_out_device_id" TEXT,
    "total_hours" DECIMAL(5,2),
    "regular_hours" DECIMAL(5,2),
    "overtime_hours" DECIMAL(5,2),
    "hours_worked" DECIMAL(5,2),
    "minutes_late" INTEGER NOT NULL DEFAULT 0,
    "late_by_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_departure_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'present',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clock_events" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "attendance_record_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_time" TIMESTAMP(3) NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "location" TEXT,
    "ip_address" TEXT,
    "device_type" TEXT,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clock_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "requested_by" TEXT,
    "overtime_date" TIMESTAMP(3) NOT NULL,
    "request_date" TIMESTAMP(3),
    "start_time" TEXT,
    "end_time" TEXT,
    "estimated_hours" DECIMAL(5,2),
    "overtime_hours" DECIMAL(5,2),
    "actual_hours" DECIMAL(5,2),
    "reason" TEXT,
    "overtime_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_summaries" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "summary_month" TIMESTAMP(3) NOT NULL,
    "total_days" INTEGER NOT NULL DEFAULT 0,
    "days_present" INTEGER NOT NULL DEFAULT 0,
    "days_absent" INTEGER NOT NULL DEFAULT 0,
    "days_late" INTEGER NOT NULL DEFAULT 0,
    "total_hours_worked" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overtime_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cycle_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "review_start_date" TIMESTAMP(3),
    "review_end_date" TIMESTAMP(3),
    "self_assessment_enabled" BOOLEAN NOT NULL DEFAULT true,
    "peer_feedback_enabled" BOOLEAN NOT NULL DEFAULT false,
    "manager_review_enabled" BOOLEAN NOT NULL DEFAULT true,
    "goals_required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "country" "Country",
    "legal_entity_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_goals" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "cycle_id" TEXT,
    "manager_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goal_type" TEXT NOT NULL DEFAULT 'individual',
    "category" TEXT,
    "metric" TEXT,
    "target_value" TEXT,
    "current_value" TEXT,
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "weight" INTEGER NOT NULL DEFAULT 0,
    "completion_percentage" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "employee_comments" TEXT,
    "manager_comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "review_number" TEXT,
    "employee_id" TEXT NOT NULL,
    "cycle_id" TEXT,
    "manager_id" TEXT,
    "review_type" TEXT NOT NULL DEFAULT 'manager_review',
    "review_period_start" TIMESTAMP(3),
    "review_period_end" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "self_assessment_date" TIMESTAMP(3),
    "manager_review_date" TIMESTAMP(3),
    "overall_rating" INTEGER,
    "goals_rating" INTEGER,
    "competencies_rating" INTEGER,
    "employee_comments" TEXT,
    "manager_comments" TEXT,
    "performance_category" TEXT,
    "recommended_for_promotion" BOOLEAN NOT NULL DEFAULT false,
    "recommended_salary_increase" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_feedback" (
    "id" TEXT NOT NULL,
    "review_id" TEXT,
    "employee_id" TEXT NOT NULL,
    "feedback_provider_id" TEXT NOT NULL,
    "feedback_type" TEXT NOT NULL,
    "relationship" TEXT,
    "overall_rating" INTEGER,
    "strengths" TEXT,
    "areas_for_improvement" TEXT,
    "collaboration_feedback" TEXT,
    "communication_feedback" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "requested_date" TIMESTAMP(3),
    "submitted_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "gl_code" TEXT,
    "requires_receipt" BOOLEAN NOT NULL DEFAULT true,
    "max_amount" DECIMAL(15,2),
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "country" "Country",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claims" (
    "id" TEXT NOT NULL,
    "claim_number" TEXT,
    "employee_id" TEXT NOT NULL,
    "category_id" TEXT,
    "category" TEXT,
    "claim_date" TIMESTAMP(3) NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "description" TEXT,
    "receipt_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "payment_ref" TEXT,
    "country" "Country",
    "legal_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_items" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "category_id" TEXT,
    "description" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "expense_date" TIMESTAMP(3) NOT NULL,
    "receipt_url" TEXT,
    "vendor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "min_amount" DECIMAL(15,2),
    "max_amount" DECIMAL(15,2),
    "interest_rate" DECIMAL(5,2) NOT NULL,
    "max_tenure_months" INTEGER NOT NULL,
    "min_tenure_months" INTEGER NOT NULL DEFAULT 1,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "eligibility_criteria" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "country" "Country",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "application_number" TEXT,
    "employee_id" TEXT NOT NULL,
    "loan_type_id" TEXT NOT NULL,
    "requested_amount" DECIMAL(15,2) NOT NULL,
    "approved_amount" DECIMAL(15,2),
    "principal_amount" DECIMAL(15,2),
    "outstanding_balance" DECIMAL(15,2),
    "interest_rate" DECIMAL(5,2),
    "repayment_months" INTEGER NOT NULL,
    "monthly_deduction" DECIMAL(15,2),
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "disbursed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "country" "Country",
    "legal_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "repayment_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "principal_paid" DECIMAL(15,2),
    "interest_paid" DECIMAL(15,2),
    "balance_after" DECIMAL(15,2),
    "payment_method" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token_hash" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_app_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "setting_key" TEXT NOT NULL,
    "setting_value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "report_name" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB,
    "columns" JSONB,
    "grouping" JSONB,
    "sorting" JSONB,
    "is_scheduled" BOOLEAN NOT NULL DEFAULT false,
    "schedule_frequency" TEXT,
    "output_format" TEXT NOT NULL DEFAULT 'csv',
    "email_recipients" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "created_by" TEXT NOT NULL,
    "country" "Country",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_executions" (
    "id" TEXT NOT NULL,
    "saved_report_id" TEXT,
    "report_name" TEXT NOT NULL,
    "execution_type" TEXT NOT NULL,
    "executed_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "record_count" INTEGER,
    "execution_time_ms" INTEGER,
    "error_message" TEXT,
    "output_url" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_kpis" (
    "id" TEXT NOT NULL,
    "kpi_name" TEXT NOT NULL,
    "kpi_type" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT,
    "current_value" DECIMAL(15,4),
    "previous_value" DECIMAL(15,4),
    "target_value" DECIMAL(15,4),
    "unit" TEXT,
    "trend" TEXT,
    "last_calculated_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "country" "Country",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "integration_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "connection_status" TEXT NOT NULL DEFAULT 'disconnected',
    "credentials" JSONB,
    "settings" JSONB,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "legal_entity_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banking_transactions" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT,
    "transaction_ref" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "recipient_name" TEXT,
    "recipient_account" TEXT,
    "recipient_bank" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "bank_reference" TEXT,
    "error_message" TEXT,
    "pay_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banking_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_sync_queue" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "sync_direction" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_slips" (
    "id" TEXT NOT NULL,
    "pay_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "gross_pay" DECIMAL(15,2) NOT NULL,
    "net_pay" DECIMAL(15,2) NOT NULL,
    "total_deductions" DECIMAL(15,2) NOT NULL,
    "tax_amount" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "file_path" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT,
    "expiry_date" TIMESTAMP(3),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dataset_type" "DataImportDatasetType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_storage_path" TEXT,
    "status" "DataImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploaded_by_user_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "published_at" TIMESTAMP(3),
    "published_by_user_id" TEXT,
    "summary_json" JSONB,
    "publish_summary_json" JSONB,
    "context_json" JSONB,
    "rows_total" INTEGER NOT NULL DEFAULT 0,
    "rows_processed" INTEGER NOT NULL DEFAULT 0,
    "rows_valid" INTEGER NOT NULL DEFAULT 0,
    "rows_invalid" INTEGER NOT NULL DEFAULT 0,
    "pipeline_started_at" TIMESTAMP(3),
    "pipeline_finished_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_user_id" TEXT,
    "cancel_reason" TEXT,
    "final_summary_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_rows" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "sheet_name" TEXT,
    "sheet_row_number" INTEGER,
    "external_key" TEXT,
    "payload_json" JSONB NOT NULL,
    "mapped_json" JSONB,
    "status" "DataImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors_count" INTEGER NOT NULL DEFAULT 0,
    "warnings_count" INTEGER NOT NULL DEFAULT 0,
    "published_entity_type" TEXT,
    "published_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_errors" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "row_id" TEXT,
    "row_number" INTEGER,
    "sheet_name" TEXT,
    "field_name" TEXT,
    "error_code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "details_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bootstrap_imports" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "status" "BootstrapImportStatus" NOT NULL DEFAULT 'UPLOADING',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_user_id" TEXT,
    "cancel_reason" TEXT,
    "datasets_json" JSONB,
    "summary_json" JSONB,
    "final_summary_json" JSONB,

    CONSTRAINT "bootstrap_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bootstrap_import_jobs" (
    "id" TEXT NOT NULL,
    "bootstrap_import_id" TEXT NOT NULL,
    "data_import_job_id" TEXT,
    "dataset_type" TEXT NOT NULL,
    "execution_order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result_json" JSONB,

    CONSTRAINT "bootstrap_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "workforce_issues" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" "WorkforceIssueEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "org_unit_id" TEXT,
    "cost_center_id" TEXT,
    "employee_id" TEXT,
    "employment_id" TEXT,
    "assignment_id" TEXT,
    "issue_type" "WorkforceIssueType" NOT NULL,
    "severity" "WorkforceIssueSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "affects_readiness" BOOLEAN NOT NULL DEFAULT true,
    "blocks_export" BOOLEAN NOT NULL DEFAULT false,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "resolution_note" TEXT,
    "assigned_user_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workforce_bulk_remediations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "issue_type" TEXT NOT NULL,
    "records_affected" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "org_unit_id" TEXT,
    "preview_summary" JSONB,
    "fix_payload" JSONB,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_bulk_remediations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workforce_remediation_approvals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "issue_type" TEXT NOT NULL,
    "records_affected" INTEGER NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "approver_user_id" TEXT,
    "status" "RemediationApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "preview_summary" JSONB,
    "fix_payload" JSONB,
    "filters" JSONB,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_remediation_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overview_stats_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legal_entities_count" INTEGER NOT NULL DEFAULT 0,
    "employees_count" INTEGER NOT NULL DEFAULT 0,
    "active_employees_count" INTEGER NOT NULL DEFAULT 0,
    "employments_count" INTEGER NOT NULL DEFAULT 0,
    "active_employments_count" INTEGER NOT NULL DEFAULT 0,
    "assignments_count" INTEGER NOT NULL DEFAULT 0,
    "active_assignments_count" INTEGER NOT NULL DEFAULT 0,
    "org_units_count" INTEGER NOT NULL DEFAULT 0,
    "cost_centers_count" INTEGER NOT NULL DEFAULT 0,
    "units_without_manager_count" INTEGER NOT NULL DEFAULT 0,
    "employees_without_manager_count" INTEGER NOT NULL DEFAULT 0,
    "employees_without_assignment_count" INTEGER NOT NULL DEFAULT 0,
    "employees_missing_cost_center_count" INTEGER NOT NULL DEFAULT 0,
    "import_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "imports_published_count" INTEGER NOT NULL DEFAULT 0,
    "imports_failed_count" INTEGER NOT NULL DEFAULT 0,
    "onboarding_completion_percent" INTEGER NOT NULL DEFAULT 0,
    "issues_count" INTEGER NOT NULL DEFAULT 0,
    "blockers_count" INTEGER NOT NULL DEFAULT 0,
    "export_ready_employees_count" INTEGER NOT NULL DEFAULT 0,
    "export_blocked_employees_count" INTEGER NOT NULL DEFAULT 0,
    "readiness_percent" INTEGER NOT NULL DEFAULT 0,
    "readiness_status" "ReadinessStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overview_stats_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entity_stats_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employees_count" INTEGER NOT NULL DEFAULT 0,
    "active_employees_count" INTEGER NOT NULL DEFAULT 0,
    "employments_count" INTEGER NOT NULL DEFAULT 0,
    "active_employments_count" INTEGER NOT NULL DEFAULT 0,
    "org_units_count" INTEGER NOT NULL DEFAULT 0,
    "root_org_units_count" INTEGER NOT NULL DEFAULT 0,
    "cost_centers_count" INTEGER NOT NULL DEFAULT 0,
    "used_cost_centers_count" INTEGER NOT NULL DEFAULT 0,
    "org_units_with_manager_count" INTEGER NOT NULL DEFAULT 0,
    "org_units_without_manager_count" INTEGER NOT NULL DEFAULT 0,
    "employees_without_manager_count" INTEGER NOT NULL DEFAULT 0,
    "employees_without_assignment_count" INTEGER NOT NULL DEFAULT 0,
    "employees_missing_cost_center_count" INTEGER NOT NULL DEFAULT 0,
    "issues_count" INTEGER NOT NULL DEFAULT 0,
    "blockers_count" INTEGER NOT NULL DEFAULT 0,
    "readiness_percent" INTEGER NOT NULL DEFAULT 0,
    "readiness_status" "ReadinessStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_entity_stats_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_unit_stats_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "org_unit_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "as_of" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direct_employees_count" INTEGER NOT NULL DEFAULT 0,
    "descendant_employees_count" INTEGER NOT NULL DEFAULT 0,
    "active_employments_count" INTEGER NOT NULL DEFAULT 0,
    "child_count" INTEGER NOT NULL DEFAULT 0,
    "descendant_org_units_count" INTEGER NOT NULL DEFAULT 0,
    "has_manager" BOOLEAN NOT NULL DEFAULT false,
    "manager_employee_id" TEXT,
    "linked_cost_center_id" TEXT,
    "issues_count" INTEGER NOT NULL DEFAULT 0,
    "blockers_count" INTEGER NOT NULL DEFAULT 0,
    "missing_manager" BOOLEAN NOT NULL DEFAULT false,
    "missing_cost_center" BOOLEAN NOT NULL DEFAULT false,
    "missing_assignments_count" INTEGER NOT NULL DEFAULT 0,
    "readiness_percent" INTEGER NOT NULL DEFAULT 0,
    "readiness_status" "ReadinessStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_unit_stats_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_center_stats_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "cost_center_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "as_of" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "org_units_count" INTEGER NOT NULL DEFAULT 0,
    "employees_count" INTEGER NOT NULL DEFAULT 0,
    "active_employments_count" INTEGER NOT NULL DEFAULT 0,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "usage_status" "CostCenterUsageStatus" NOT NULL DEFAULT 'UNUSED',
    "issues_count" INTEGER NOT NULL DEFAULT 0,
    "blockers_count" INTEGER NOT NULL DEFAULT 0,
    "readiness_percent" INTEGER NOT NULL DEFAULT 0,
    "readiness_status" "ReadinessStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_center_stats_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" "ReadinessEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "as_of" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manager_completeness_percent" INTEGER NOT NULL DEFAULT 0,
    "org_assignment_percent" INTEGER NOT NULL DEFAULT 0,
    "cost_center_coverage_percent" INTEGER NOT NULL DEFAULT 0,
    "employment_completeness_percent" INTEGER NOT NULL DEFAULT 0,
    "identity_completeness_percent" INTEGER NOT NULL DEFAULT 0,
    "blockers_count" INTEGER NOT NULL DEFAULT 0,
    "warnings_count" INTEGER NOT NULL DEFAULT 0,
    "readiness_percent" INTEGER NOT NULL DEFAULT 0,
    "readiness_status" "ReadinessStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "readiness_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_unit_manager_suggestions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "org_unit_id" TEXT NOT NULL,
    "suggested_employee_id" TEXT NOT NULL,
    "confidence_score" INTEGER NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason_details" TEXT,
    "status" "OrgManagerSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_unit_manager_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrun_exceptions" (
    "id" TEXT NOT NULL,
    "payrun_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "code" TEXT NOT NULL,
    "type" "PayrunExceptionType" NOT NULL,
    "severity" "PayrunExceptionSeverity" NOT NULL,
    "status" "PayrunExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detected_by_type" "DetectedByType" NOT NULL DEFAULT 'SYSTEM',
    "owner_user_id" TEXT,
    "blocks_submission" BOOLEAN NOT NULL DEFAULT false,
    "blocks_payment" BOOLEAN NOT NULL DEFAULT false,
    "resolution_type" "PayrunExceptionResolutionType",
    "resolution_note" TEXT,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "dismissed_by_user_id" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "dismissal_reason" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrun_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_compliance_reports" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "legal_entity_name" TEXT,
    "payrun_id" TEXT,
    "report_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submission_status" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "period_name" TEXT,
    "totals" JSONB,
    "generated_at" TIMESTAMP(3),
    "generated_by_user_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "submitted_by_user_id" TEXT,
    "submission_reference" TEXT,
    "evidence_file_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_compliance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_payroll_opening_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "ytd_gross" DECIMAL(18,2) NOT NULL,
    "ytd_taxable" DECIMAL(18,2) NOT NULL,
    "ytd_paye" DECIMAL(18,2) NOT NULL,
    "ytd_net" DECIMAL(18,2) NOT NULL,
    "ytd_uif_employee" DECIMAL(18,2),
    "ytd_uif_employer" DECIMAL(18,2),
    "ytd_sdl" DECIMAL(18,2),
    "ytd_employer_cost" DECIMAL(18,2),
    "ytd_pension" DECIMAL(18,2),
    "ytd_other_deductions" DECIMAL(18,2),
    "as_of_date" DATE,
    "import_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_payroll_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_leave_opening_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "unit" TEXT DEFAULT 'DAYS',
    "as_of_date" DATE NOT NULL,
    "import_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_leave_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_loan_opening_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "deduction_code" TEXT NOT NULL,
    "remaining_balance" DECIMAL(18,2) NOT NULL,
    "installment_amount" DECIMAL(18,2),
    "original_balance" DECIMAL(18,2),
    "reference_no" TEXT,
    "as_of_date" DATE NOT NULL,
    "import_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_loan_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_returns" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "pay_group_id" TEXT,
    "return_code" TEXT NOT NULL,
    "return_label" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_due" DECIMAL(18,2) NOT NULL,
    "employee_count" INTEGER NOT NULL,
    "source_payrun_ids" JSONB NOT NULL,
    "display_schema_key" TEXT,
    "statutory_profile_key" TEXT NOT NULL,
    "country_pack_version" TEXT,
    "generated_at" TIMESTAMP(3),
    "generated_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "submitted_by_user_id" TEXT,
    "submission_reference" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_user_id" TEXT,
    "evidence_bundle_id" TEXT,
    "amends_return_id" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "filing_due_date" DATE,
    "filing_authority" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statutory_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_return_items" (
    "id" TEXT NOT NULL,
    "statutory_return_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_label" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "source_line_codes" JSONB NOT NULL,
    "employee_count" INTEGER,
    "sort_order" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_evidence_bundles" (
    "id" TEXT NOT NULL,
    "statutory_return_id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "return_code" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "artifacts" JSONB NOT NULL,
    "created_by_user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_evidence_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_workflow_events" (
    "id" TEXT NOT NULL,
    "statutory_return_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "performed_by_user_id" TEXT,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,
    "metadata" JSONB,

    CONSTRAINT "statutory_workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_table_authoring_versions" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "table_type" TEXT NOT NULL,
    "tax_year" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source_type" TEXT NOT NULL,
    "source_reference" TEXT,
    "source_checksum" TEXT,
    "template_id" TEXT,
    "template_code" TEXT,
    "template_version" TEXT,
    "copied_from_authoring_id" TEXT,
    "published_tax_table_set_id" TEXT,
    "publish_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "reviewed_by_user_id" TEXT,
    "published_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "tax_table_authoring_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_table_authoring_brackets" (
    "id" TEXT NOT NULL,
    "authoring_version_id" TEXT NOT NULL,
    "seq_no" INTEGER NOT NULL,
    "bracket_from" DECIMAL(18,2) NOT NULL,
    "bracket_to" DECIMAL(18,2),
    "marginal_rate" DECIMAL(8,5) NOT NULL,
    "base_tax" DECIMAL(18,2) NOT NULL,
    "derived_base_tax" DECIMAL(18,2),
    "is_open_ended" BOOLEAN NOT NULL DEFAULT false,
    "base_tax_override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_table_authoring_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_table_authoring_fields" (
    "id" TEXT NOT NULL,
    "authoring_version_id" TEXT NOT NULL,
    "field_code" TEXT NOT NULL,
    "field_value_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_table_authoring_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_table_authoring_audit_events" (
    "id" TEXT NOT NULL,
    "authoring_version_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_table_authoring_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_table_impact_analysis_runs" (
    "id" TEXT NOT NULL,
    "authoring_version_id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "basis_mode" TEXT NOT NULL,
    "pay_group_id" TEXT,
    "payrun_id" TEXT,
    "legal_entity_id" TEXT,
    "limit_value" INTEGER,
    "affected_only" BOOLEAN NOT NULL DEFAULT false,
    "min_absolute_delta" DECIMAL(18,2),
    "source_draft_checksum" TEXT,
    "source_runtime_tax_table_set_id" TEXT,
    "source_runtime_checksum" TEXT,
    "employees_analyzed" INTEGER NOT NULL,
    "employees_affected" INTEGER NOT NULL,
    "employees_skipped" INTEGER NOT NULL,
    "total_baseline_paye" DECIMAL(18,2) NOT NULL,
    "total_draft_paye" DECIMAL(18,2) NOT NULL,
    "total_paye_delta" DECIMAL(18,2) NOT NULL,
    "average_delta_all" DECIMAL(18,2) NOT NULL,
    "average_delta_affected" DECIMAL(18,2) NOT NULL,
    "biggest_increase_json" JSONB,
    "biggest_decrease_json" JSONB,
    "bucket_summary_json" JSONB,
    "warnings_json" JSONB,
    "run_by_user_id" TEXT NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_table_impact_analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_table_impact_analysis_row_snapshots" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_number" TEXT,
    "employee_name" TEXT,
    "legal_entity_name" TEXT,
    "pay_group_name" TEXT,
    "taxable_earnings" DECIMAL(18,2) NOT NULL,
    "baseline_paye" DECIMAL(18,2) NOT NULL,
    "draft_paye" DECIMAL(18,2) NOT NULL,
    "delta_paye" DECIMAL(18,2) NOT NULL,
    "absolute_delta" DECIMAL(18,2) NOT NULL,
    "direction" TEXT NOT NULL,
    "baseline_bracket_label" TEXT,
    "draft_bracket_label" TEXT,

    CONSTRAINT "tax_table_impact_analysis_row_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_table_impact_analysis_reviews" (
    "id" TEXT NOT NULL,
    "impact_analysis_run_id" TEXT NOT NULL,
    "authoring_version_id" TEXT NOT NULL,
    "review_status" TEXT NOT NULL,
    "review_comment" TEXT,
    "reviewed_by_user_id" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_table_impact_analysis_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctc_optimiser_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "legal_entity_id" TEXT,
    "employee_id" TEXT,
    "country_code" TEXT NOT NULL,
    "tax_year" TEXT NOT NULL,
    "pay_frequency" TEXT NOT NULL,
    "optimisation_mode" TEXT NOT NULL,
    "input_json" JSONB NOT NULL,
    "routing_json" JSONB,
    "assumptions_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "selected_scenario_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "applied_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "ctc_optimiser_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctc_optimiser_scenarios" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "scenario_code" TEXT NOT NULL,
    "rank" INTEGER,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "policy_status" TEXT NOT NULL DEFAULT 'PASS',
    "input_breakdown_json" JSONB NOT NULL,
    "payroll_output_json" JSONB NOT NULL,
    "explanations_json" JSONB,
    "warnings_json" JSONB,
    "score_total" DOUBLE PRECISION,
    "score_breakdown_json" JSONB,
    "checksum" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctc_optimiser_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctc_optimiser_decisions" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "decision_type" TEXT NOT NULL,
    "decision_status" TEXT NOT NULL DEFAULT 'PENDING',
    "decided_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "ctc_optimiser_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_assignments_user_id_idx" ON "role_assignments"("user_id");

-- CreateIndex
CREATE INDEX "role_assignments_role_id_idx" ON "role_assignments"("role_id");

-- CreateIndex
CREATE INDEX "role_assignments_legal_entity_id_idx" ON "role_assignments"("legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_user_id_role_id_scope_type_legal_entity_id_key" ON "role_assignments"("user_id", "role_id", "scope_type", "legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entities_code_key" ON "legal_entities"("code");

-- CreateIndex
CREATE INDEX "work_locations_legal_entity_id_idx" ON "work_locations"("legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_locations_legal_entity_id_code_key" ON "work_locations"("legal_entity_id", "code");

-- CreateIndex
CREATE INDEX "org_units_legal_entity_id_idx" ON "org_units"("legal_entity_id");

-- CreateIndex
CREATE INDEX "org_units_parent_org_unit_id_idx" ON "org_units"("parent_org_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_units_legal_entity_id_code_key" ON "org_units"("legal_entity_id", "code");

-- CreateIndex
CREATE INDEX "positions_org_unit_id_idx" ON "positions"("org_unit_id");

-- CreateIndex
CREATE INDEX "positions_legal_entity_id_idx" ON "positions"("legal_entity_id");

-- CreateIndex
CREATE INDEX "positions_status_idx" ON "positions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "positions_legal_entity_id_position_code_key" ON "positions"("legal_entity_id", "position_code");

-- CreateIndex
CREATE UNIQUE INDEX "pay_groups_code_key" ON "pay_groups"("code");

-- CreateIndex
CREATE INDEX "payrolls_pay_group_id_idx" ON "payrolls"("pay_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_pay_group_tax_year_window_key" ON "payrolls"("pay_group_id", "tax_year_start", "tax_year_end");

-- CreateIndex
CREATE INDEX "payroll_governance_policies_policy_key_scope_legal_entity_i_idx" ON "payroll_governance_policies"("policy_key", "scope", "legal_entity_id", "pay_group_id");

-- CreateIndex
CREATE INDEX "payroll_governance_policies_legal_entity_id_idx" ON "payroll_governance_policies"("legal_entity_id");

-- CreateIndex
CREATE INDEX "payroll_governance_policies_pay_group_id_idx" ON "payroll_governance_policies"("pay_group_id");

-- CreateIndex
CREATE INDEX "payroll_governance_policies_superseded_by_policy_id_idx" ON "payroll_governance_policies"("superseded_by_policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_governance_policy_drafts_activation_policy_id_key" ON "payroll_governance_policy_drafts"("activation_policy_id");

-- CreateIndex
CREATE INDEX "payroll_governance_policy_drafts_status_idx" ON "payroll_governance_policy_drafts"("status");

-- CreateIndex
CREATE INDEX "payroll_governance_policy_drafts_policy_key_scope_legal_ent_idx" ON "payroll_governance_policy_drafts"("policy_key", "scope", "legal_entity_id", "pay_group_id");

-- CreateIndex
CREATE INDEX "payroll_governance_policy_drafts_requested_by_user_id_idx" ON "payroll_governance_policy_drafts"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "pay_periods_payroll_id_idx" ON "pay_periods"("payroll_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_periods_pay_group_id_year_period_num_key" ON "pay_periods"("pay_group_id", "year", "period_num");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_no_key" ON "employees"("employee_no");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employments_employee_id_effective_from_idx" ON "employments"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "employments_updated_at_idx" ON "employments"("updated_at");

-- CreateIndex
CREATE INDEX "employment_assignments_employment_id_effective_from_idx" ON "employment_assignments"("employment_id", "effective_from");

-- CreateIndex
CREATE INDEX "employment_assignments_org_unit_id_idx" ON "employment_assignments"("org_unit_id");

-- CreateIndex
CREATE INDEX "employment_assignments_position_id_idx" ON "employment_assignments"("position_id");

-- CreateIndex
CREATE INDEX "compensations_employee_id_effective_from_idx" ON "compensations"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "bank_accounts_employee_id_effective_from_idx" ON "bank_accounts"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "tax_profiles_employee_id_effective_from_idx" ON "tax_profiles"("employee_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "pay_items_code_key" ON "pay_items"("code");

-- CreateIndex
CREATE INDEX "pay_items_pay_group_id_is_active_idx" ON "pay_items"("pay_group_id", "is_active");

-- CreateIndex
CREATE INDEX "pay_items_type_is_active_idx" ON "pay_items"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "rules_code_key" ON "rules"("code");

-- CreateIndex
CREATE INDEX "rules_country_effective_from_idx" ON "rules"("country", "effective_from");

-- CreateIndex
CREATE INDEX "pack_registry_country_status_effective_from_idx" ON "pack_registry"("country", "status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "pack_registry_country_pack_version_key" ON "pack_registry"("country", "pack_version");

-- CreateIndex
CREATE INDEX "tax_table_sets_country_table_type_status_effective_from_idx" ON "tax_table_sets"("country", "table_type", "status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "tax_table_sets_country_table_type_tax_year_key" ON "tax_table_sets"("country", "table_type", "tax_year");

-- CreateIndex
CREATE INDEX "statutory_configs_country_config_type_status_idx" ON "statutory_configs"("country", "config_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_configs_country_config_type_effective_from_key" ON "statutory_configs"("country", "config_type", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "tax_tables_country_effective_from_key" ON "tax_tables"("country", "effective_from");

-- CreateIndex
CREATE INDEX "tax_brackets_tax_table_id_sort_order_idx" ON "tax_brackets"("tax_table_id", "sort_order");

-- CreateIndex
CREATE INDEX "payruns_pay_group_id_status_idx" ON "payruns"("pay_group_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payrun_reversal_workflows_reversal_payrun_id_key" ON "payrun_reversal_workflows"("reversal_payrun_id");

-- CreateIndex
CREATE INDEX "payrun_reversal_workflows_source_payrun_id_status_idx" ON "payrun_reversal_workflows"("source_payrun_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payrun_correction_approvals_approval_reference_key" ON "payrun_correction_approvals"("approval_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payrun_correction_approvals_resulting_adjustment_payrun_id_key" ON "payrun_correction_approvals"("resulting_adjustment_payrun_id");

-- CreateIndex
CREATE INDEX "payrun_correction_approvals_payrun_id_status_idx" ON "payrun_correction_approvals"("payrun_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payrun_contexts_payrun_id_key" ON "payrun_contexts"("payrun_id");

-- CreateIndex
CREATE UNIQUE INDEX "payrun_employees_payrun_id_employee_id_key" ON "payrun_employees"("payrun_id", "employee_id");

-- CreateIndex
CREATE INDEX "line_item_inputs_payrun_id_employee_id_idx" ON "line_item_inputs"("payrun_id", "employee_id");

-- CreateIndex
CREATE INDEX "recurring_inputs_employee_id_is_active_idx" ON "recurring_inputs"("employee_id", "is_active");

-- CreateIndex
CREATE INDEX "recurring_inputs_pay_item_id_idx" ON "recurring_inputs"("pay_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_results_payrun_id_employee_id_key" ON "employee_results"("payrun_id", "employee_id");

-- CreateIndex
CREATE INDEX "pay_lines_employee_result_id_idx" ON "pay_lines"("employee_result_id");

-- CreateIndex
CREATE INDEX "change_requests_status_kind_idx" ON "change_requests"("status", "kind");

-- CreateIndex
CREATE INDEX "change_requests_subject_entity_id_idx" ON "change_requests"("subject_entity_id");

-- CreateIndex
CREATE INDEX "imports_payrun_id_idx" ON "imports"("payrun_id");

-- CreateIndex
CREATE INDEX "artifacts_payrun_id_idx" ON "artifacts"("payrun_id");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_entity_type_legal_entity_id_pay_group_id_key" ON "approval_workflows"("entity_type", "legal_entity_id", "pay_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_levels_workflow_id_level_order_key" ON "approval_levels"("workflow_id", "level_order");

-- CreateIndex
CREATE INDEX "approval_instances_entity_type_entity_id_idx" ON "approval_instances"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_instances_entity_type_entity_id_key" ON "approval_instances"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "approval_steps_assigned_to_status_idx" ON "approval_steps"("assigned_to", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_instance_id_level_order_key" ON "approval_steps"("instance_id", "level_order");

-- CreateIndex
CREATE INDEX "approval_delegations_delegator_id_start_date_end_date_idx" ON "approval_delegations"("delegator_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "company_groups_group_code_key" ON "company_groups"("group_code");

-- CreateIndex
CREATE UNIQUE INDEX "company_group_members_group_id_legal_entity_id_key" ON "company_group_members"("group_id", "legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_cost_center_code_key" ON "cost_centers"("cost_center_code");

-- CreateIndex
CREATE INDEX "tax_certificates_tax_year_idx" ON "tax_certificates"("tax_year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_certificates_employee_id_tax_year_key" ON "tax_certificates"("employee_id", "tax_year");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_type_key" ON "notification_preferences"("user_id", "type");

-- CreateIndex
CREATE INDEX "webhooks_legal_entity_id_active_idx" ON "webhooks"("legal_entity_id", "active");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "integrations_organization_id_status_idx" ON "integrations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "integrations_type_idx" ON "integrations"("type");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_integration_id_is_active_idx" ON "api_keys"("integration_id", "is_active");

-- CreateIndex
CREATE INDEX "sync_logs_integration_id_created_at_idx" ON "sync_logs"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_integration_id_created_at_idx" ON "webhook_deliveries"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_success_idx" ON "webhook_deliveries"("success");

-- CreateIndex
CREATE INDEX "gl_accounts_organization_id_is_active_idx" ON "gl_accounts"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "gl_accounts_organization_id_code_key" ON "gl_accounts"("organization_id", "code");

-- CreateIndex
CREATE INDEX "gl_journals_organization_id_journal_date_idx" ON "gl_journals"("organization_id", "journal_date");

-- CreateIndex
CREATE INDEX "gl_journals_payrun_id_idx" ON "gl_journals"("payrun_id");

-- CreateIndex
CREATE INDEX "gl_journal_lines_journal_id_idx" ON "gl_journal_lines"("journal_id");

-- CreateIndex
CREATE INDEX "payment_batches_organization_id_status_idx" ON "payment_batches"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payment_batches_payrun_id_idx" ON "payment_batches"("payrun_id");

-- CreateIndex
CREATE INDEX "payment_batches_status_idx" ON "payment_batches"("status");

-- CreateIndex
CREATE INDEX "payment_batches_export_status_idx" ON "payment_batches"("export_status");

-- CreateIndex
CREATE INDEX "payments_batch_id_idx" ON "payments"("batch_id");

-- CreateIndex
CREATE INDEX "payments_employee_id_idx" ON "payments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payrun_financial_controls_payrun_id_key" ON "payrun_financial_controls"("payrun_id");

-- CreateIndex
CREATE INDEX "payrun_financial_controls_payment_batch_id_idx" ON "payrun_financial_controls"("payment_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "payrun_bank_reconciliations_payment_batch_id_key" ON "payrun_bank_reconciliations"("payment_batch_id");

-- CreateIndex
CREATE INDEX "payrun_bank_reconciliations_payrun_id_idx" ON "payrun_bank_reconciliations"("payrun_id");

-- CreateIndex
CREATE INDEX "payrun_bank_reconciliations_organization_id_bank_file_hash_idx" ON "payrun_bank_reconciliations"("organization_id", "bank_file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "payrun_gl_reconciliations_payrun_id_key" ON "payrun_gl_reconciliations"("payrun_id");

-- CreateIndex
CREATE INDEX "payrun_gl_reconciliations_legal_entity_id_gl_posting_hash_idx" ON "payrun_gl_reconciliations"("legal_entity_id", "gl_posting_hash");

-- CreateIndex
CREATE INDEX "leave_types_country_is_active_idx" ON "leave_types"("country", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_organization_id_country_code_key" ON "leave_types"("organization_id", "country", "code");

-- CreateIndex
CREATE INDEX "leave_balances_employee_id_idx" ON "leave_balances"("employee_id");

-- CreateIndex
CREATE INDEX "leave_balances_leave_type_id_idx" ON "leave_balances"("leave_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_cycle_start_date_key" ON "leave_balances"("employee_id", "leave_type_id", "cycle_start_date");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_status_idx" ON "leave_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_start_date_end_date_idx" ON "leave_requests"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_accruals_employee_id_accrual_date_idx" ON "leave_accruals"("employee_id", "accrual_date");

-- CreateIndex
CREATE INDEX "leave_accruals_leave_type_id_idx" ON "leave_accruals"("leave_type_id");

-- CreateIndex
CREATE INDEX "leave_accruals_accrual_type_idx" ON "leave_accruals"("accrual_type");

-- CreateIndex
CREATE INDEX "leave_policies_organization_id_effective_from_idx" ON "leave_policies"("organization_id", "effective_from");

-- CreateIndex
CREATE INDEX "leave_policies_country_is_active_idx" ON "leave_policies"("country", "is_active");

-- CreateIndex
CREATE INDEX "public_holidays_country_year_idx" ON "public_holidays"("country", "year");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_country_year_date_key" ON "public_holidays"("country", "year", "date");

-- CreateIndex
CREATE INDEX "document_types_category_is_active_idx" ON "document_types"("category", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_organization_id_code_key" ON "document_types"("organization_id", "code");

-- CreateIndex
CREATE INDEX "documents_employee_id_status_idx" ON "documents"("employee_id", "status");

-- CreateIndex
CREATE INDEX "documents_document_type_id_idx" ON "documents"("document_type_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_status_idx" ON "documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "documents_expiry_date_idx" ON "documents"("expiry_date");

-- CreateIndex
CREATE INDEX "document_access_logs_document_id_accessed_at_idx" ON "document_access_logs"("document_id", "accessed_at");

-- CreateIndex
CREATE INDEX "document_access_logs_user_id_accessed_at_idx" ON "document_access_logs"("user_id", "accessed_at");

-- CreateIndex
CREATE INDEX "document_expiry_alerts_alert_date_alert_sent_idx" ON "document_expiry_alerts"("alert_date", "alert_sent");

-- CreateIndex
CREATE UNIQUE INDEX "document_expiry_alerts_document_id_days_before_expiry_key" ON "document_expiry_alerts"("document_id", "days_before_expiry");

-- CreateIndex
CREATE INDEX "document_requests_employee_id_status_idx" ON "document_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "document_requests_organization_id_status_idx" ON "document_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "document_requests_due_date_idx" ON "document_requests"("due_date");

-- CreateIndex
CREATE INDEX "payroll_reconciliations_period_id_idx" ON "payroll_reconciliations"("period_id");

-- CreateIndex
CREATE INDEX "payroll_reconciliations_status_idx" ON "payroll_reconciliations"("status");

-- CreateIndex
CREATE INDEX "payroll_reconciliation_items_reconciliation_id_idx" ON "payroll_reconciliation_items"("reconciliation_id");

-- CreateIndex
CREATE INDEX "payroll_exceptions_period_id_status_idx" ON "payroll_exceptions"("period_id", "status");

-- CreateIndex
CREATE INDEX "payroll_exceptions_payrun_id_idx" ON "payroll_exceptions"("payrun_id");

-- CreateIndex
CREATE INDEX "payroll_exceptions_employee_id_idx" ON "payroll_exceptions"("employee_id");

-- CreateIndex
CREATE INDEX "payroll_exceptions_severity_idx" ON "payroll_exceptions"("severity");

-- CreateIndex
CREATE INDEX "payroll_forecasts_legal_entity_id_status_idx" ON "payroll_forecasts"("legal_entity_id", "status");

-- CreateIndex
CREATE INDEX "payroll_forecast_items_forecast_id_idx" ON "payroll_forecast_items"("forecast_id");

-- CreateIndex
CREATE INDEX "payroll_checklist_template_items_template_id_task_order_idx" ON "payroll_checklist_template_items"("template_id", "task_order");

-- CreateIndex
CREATE INDEX "payroll_checklists_period_id_idx" ON "payroll_checklists"("period_id");

-- CreateIndex
CREATE INDEX "payroll_checklist_tasks_checklist_id_task_order_idx" ON "payroll_checklist_tasks"("checklist_id", "task_order");

-- CreateIndex
CREATE INDEX "payroll_checklist_tasks_assigned_to_status_idx" ON "payroll_checklist_tasks"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "benefit_plans_benefit_type_is_active_idx" ON "benefit_plans"("benefit_type", "is_active");

-- CreateIndex
CREATE INDEX "benefit_plans_provider_name_idx" ON "benefit_plans"("provider_name");

-- CreateIndex
CREATE INDEX "benefit_plan_options_plan_id_is_active_idx" ON "benefit_plan_options"("plan_id", "is_active");

-- CreateIndex
CREATE INDEX "benefit_rates_plan_id_effective_date_idx" ON "benefit_rates"("plan_id", "effective_date");

-- CreateIndex
CREATE INDEX "employee_benefits_employee_id_status_idx" ON "employee_benefits"("employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_benefits_plan_id_idx" ON "employee_benefits"("plan_id");

-- CreateIndex
CREATE INDEX "benefit_deductions_enrollment_id_period_start_idx" ON "benefit_deductions"("enrollment_id", "period_start");

-- CreateIndex
CREATE INDEX "benefit_enrollment_history_enrollment_id_changed_at_idx" ON "benefit_enrollment_history"("enrollment_id", "changed_at");

-- CreateIndex
CREATE INDEX "uif_declarations_declaration_period_idx" ON "uif_declarations"("declaration_period");

-- CreateIndex
CREATE INDEX "uif_declarations_status_idx" ON "uif_declarations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uif_declarations_legal_entity_id_declaration_period_key" ON "uif_declarations"("legal_entity_id", "declaration_period");

-- CreateIndex
CREATE INDEX "uif_declaration_lines_declaration_id_idx" ON "uif_declaration_lines"("declaration_id");

-- CreateIndex
CREATE INDEX "sdl_declarations_declaration_period_idx" ON "sdl_declarations"("declaration_period");

-- CreateIndex
CREATE INDEX "sdl_declarations_status_idx" ON "sdl_declarations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sdl_declarations_legal_entity_id_declaration_period_key" ON "sdl_declarations"("legal_entity_id", "declaration_period");

-- CreateIndex
CREATE INDEX "sdl_declaration_lines_declaration_id_idx" ON "sdl_declaration_lines"("declaration_id");

-- CreateIndex
CREATE INDEX "coida_assessments_assessment_year_idx" ON "coida_assessments"("assessment_year");

-- CreateIndex
CREATE INDEX "coida_assessments_status_idx" ON "coida_assessments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "coida_assessments_legal_entity_id_assessment_year_key" ON "coida_assessments"("legal_entity_id", "assessment_year");

-- CreateIndex
CREATE INDEX "coida_assessment_lines_assessment_id_idx" ON "coida_assessment_lines"("assessment_id");

-- CreateIndex
CREATE INDEX "email_notifications_status_created_at_idx" ON "email_notifications"("status", "created_at");

-- CreateIndex
CREATE INDEX "email_notifications_recipient_email_idx" ON "email_notifications"("recipient_email");

-- CreateIndex
CREATE INDEX "sms_notifications_status_created_at_idx" ON "sms_notifications"("status", "created_at");

-- CreateIndex
CREATE INDEX "sms_notifications_recipient_phone_idx" ON "sms_notifications"("recipient_phone");

-- CreateIndex
CREATE INDEX "mobile_devices_user_id_is_active_idx" ON "mobile_devices"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "push_notifications_user_id_status_idx" ON "push_notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "push_notifications_scheduled_for_status_idx" ON "push_notifications"("scheduled_for", "status");

-- CreateIndex
CREATE INDEX "workflow_notifications_recipient_id_status_idx" ON "workflow_notifications"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "workflow_notifications_workflow_type_workflow_id_idx" ON "workflow_notifications"("workflow_type", "workflow_id");

-- CreateIndex
CREATE INDEX "in_app_notifications_user_id_is_read_created_at_idx" ON "in_app_notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "alert_schedules_is_active_next_run_at_idx" ON "alert_schedules"("is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "scheduled_reports_is_active_next_run_at_idx" ON "scheduled_reports"("is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "notification_log_created_at_idx" ON "notification_log"("created_at");

-- CreateIndex
CREATE INDEX "tax_periods_tax_year_period_type_idx" ON "tax_periods"("tax_year", "period_type");

-- CreateIndex
CREATE UNIQUE INDEX "tax_periods_tax_year_period_type_month_number_key" ON "tax_periods"("tax_year", "period_type", "month_number");

-- CreateIndex
CREATE INDEX "irp5_certificates_employee_id_idx" ON "irp5_certificates"("employee_id");

-- CreateIndex
CREATE INDEX "irp5_certificates_legal_entity_id_idx" ON "irp5_certificates"("legal_entity_id");

-- CreateIndex
CREATE INDEX "irp5_certificates_status_idx" ON "irp5_certificates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "irp5_certificates_tax_period_id_employee_id_key" ON "irp5_certificates"("tax_period_id", "employee_id");

-- CreateIndex
CREATE INDEX "emp201_returns_tax_year_month_number_idx" ON "emp201_returns"("tax_year", "month_number");

-- CreateIndex
CREATE INDEX "emp201_returns_status_idx" ON "emp201_returns"("status");

-- CreateIndex
CREATE INDEX "emp201_returns_legal_entity_id_idx" ON "emp201_returns"("legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "emp201_returns_tax_period_id_legal_entity_id_key" ON "emp201_returns"("tax_period_id", "legal_entity_id");

-- CreateIndex
CREATE INDEX "emp501_reconciliations_tax_year_idx" ON "emp501_reconciliations"("tax_year");

-- CreateIndex
CREATE INDEX "emp501_reconciliations_status_idx" ON "emp501_reconciliations"("status");

-- CreateIndex
CREATE INDEX "emp501_reconciliations_legal_entity_id_idx" ON "emp501_reconciliations"("legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "emp501_reconciliations_tax_period_id_legal_entity_id_key" ON "emp501_reconciliations"("tax_period_id", "legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "sars_validation_rules_rule_code_key" ON "sars_validation_rules"("rule_code");

-- CreateIndex
CREATE INDEX "sars_validation_rules_applies_to_is_active_idx" ON "sars_validation_rules"("applies_to", "is_active");

-- CreateIndex
CREATE INDEX "sars_validation_results_validation_run_id_idx" ON "sars_validation_results"("validation_run_id");

-- CreateIndex
CREATE INDEX "sars_validation_results_document_type_document_id_idx" ON "sars_validation_results"("document_type", "document_id");

-- CreateIndex
CREATE INDEX "sars_submissions_submission_type_document_id_idx" ON "sars_submissions"("submission_type", "document_id");

-- CreateIndex
CREATE INDEX "sars_submissions_legal_entity_id_idx" ON "sars_submissions"("legal_entity_id");

-- CreateIndex
CREATE INDEX "sars_submissions_status_idx" ON "sars_submissions"("status");

-- CreateIndex
CREATE INDEX "sars_submission_queue_batch_id_status_idx" ON "sars_submission_queue"("batch_id", "status");

-- CreateIndex
CREATE INDEX "sars_submission_queue_legal_entity_id_idx" ON "sars_submission_queue"("legal_entity_id");

-- CreateIndex
CREATE INDEX "sars_submission_queue_status_priority_idx" ON "sars_submission_queue"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidates_status_idx" ON "candidates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_requisitions_requisition_number_key" ON "job_requisitions"("requisition_number");

-- CreateIndex
CREATE INDEX "job_requisitions_status_idx" ON "job_requisitions"("status");

-- CreateIndex
CREATE INDEX "job_requisitions_department_idx" ON "job_requisitions"("department");

-- CreateIndex
CREATE INDEX "job_requisitions_work_location_id_idx" ON "job_requisitions"("work_location_id");

-- CreateIndex
CREATE INDEX "job_applications_status_idx" ON "job_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_candidate_id_requisition_id_key" ON "job_applications"("candidate_id", "requisition_id");

-- CreateIndex
CREATE INDEX "interviews_candidate_id_idx" ON "interviews"("candidate_id");

-- CreateIndex
CREATE INDEX "interviews_scheduled_date_idx" ON "interviews"("scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "interview_feedback_interview_id_interviewer_id_key" ON "interview_feedback"("interview_id", "interviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_offers_offer_number_key" ON "job_offers"("offer_number");

-- CreateIndex
CREATE INDEX "job_offers_candidate_id_idx" ON "job_offers"("candidate_id");

-- CreateIndex
CREATE INDEX "job_offers_status_idx" ON "job_offers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_workflows_source_offer_id_key" ON "onboarding_workflows"("source_offer_id");

-- CreateIndex
CREATE INDEX "onboarding_workflows_employee_id_idx" ON "onboarding_workflows"("employee_id");

-- CreateIndex
CREATE INDEX "onboarding_workflows_status_idx" ON "onboarding_workflows"("status");

-- CreateIndex
CREATE INDEX "onboarding_tasks_workflow_id_idx" ON "onboarding_tasks"("workflow_id");

-- CreateIndex
CREATE INDEX "onboarding_tasks_status_idx" ON "onboarding_tasks"("status");

-- CreateIndex
CREATE INDEX "onboarding_documents_workflow_id_idx" ON "onboarding_documents"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_shift_code_key" ON "shifts"("shift_code");

-- CreateIndex
CREATE INDEX "shifts_shift_type_idx" ON "shifts"("shift_type");

-- CreateIndex
CREATE INDEX "shift_assignments_employee_id_effective_from_idx" ON "shift_assignments"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_attendance_date_idx" ON "attendance_records"("employee_id", "attendance_date");

-- CreateIndex
CREATE INDEX "attendance_records_work_date_idx" ON "attendance_records"("work_date");

-- CreateIndex
CREATE INDEX "clock_events_employee_id_event_time_idx" ON "clock_events"("employee_id", "event_time");

-- CreateIndex
CREATE INDEX "overtime_requests_employee_id_idx" ON "overtime_requests"("employee_id");

-- CreateIndex
CREATE INDEX "overtime_requests_status_idx" ON "overtime_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_summaries_employee_id_summary_month_key" ON "attendance_summaries"("employee_id", "summary_month");

-- CreateIndex
CREATE INDEX "performance_cycles_status_idx" ON "performance_cycles"("status");

-- CreateIndex
CREATE INDEX "performance_goals_employee_id_idx" ON "performance_goals"("employee_id");

-- CreateIndex
CREATE INDEX "performance_goals_cycle_id_idx" ON "performance_goals"("cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_review_number_key" ON "performance_reviews"("review_number");

-- CreateIndex
CREATE INDEX "performance_reviews_employee_id_idx" ON "performance_reviews"("employee_id");

-- CreateIndex
CREATE INDEX "performance_reviews_cycle_id_idx" ON "performance_reviews"("cycle_id");

-- CreateIndex
CREATE INDEX "performance_feedback_employee_id_idx" ON "performance_feedback"("employee_id");

-- CreateIndex
CREATE INDEX "performance_feedback_review_id_idx" ON "performance_feedback"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_code_key" ON "expense_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "expense_claims_claim_number_key" ON "expense_claims"("claim_number");

-- CreateIndex
CREATE INDEX "expense_claims_employee_id_idx" ON "expense_claims"("employee_id");

-- CreateIndex
CREATE INDEX "expense_claims_status_idx" ON "expense_claims"("status");

-- CreateIndex
CREATE INDEX "expense_items_claim_id_idx" ON "expense_items"("claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_types_code_key" ON "loan_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_application_number_key" ON "loan_applications"("application_number");

-- CreateIndex
CREATE INDEX "loan_applications_employee_id_idx" ON "loan_applications"("employee_id");

-- CreateIndex
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");

-- CreateIndex
CREATE INDEX "loan_repayments_loan_id_idx" ON "loan_repayments"("loan_id");

-- CreateIndex
CREATE INDEX "mobile_sessions_user_id_is_active_idx" ON "mobile_sessions"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "mobile_sessions_device_id_idx" ON "mobile_sessions"("device_id");

-- CreateIndex
CREATE INDEX "mobile_app_settings_user_id_setting_key_idx" ON "mobile_app_settings"("user_id", "setting_key");

-- CreateIndex
CREATE INDEX "saved_reports_created_by_idx" ON "saved_reports"("created_by");

-- CreateIndex
CREATE INDEX "report_executions_saved_report_id_idx" ON "report_executions"("saved_report_id");

-- CreateIndex
CREATE INDEX "analytics_kpis_kpi_type_is_active_idx" ON "analytics_kpis"("kpi_type", "is_active");

-- CreateIndex
CREATE INDEX "integration_connections_integration_type_idx" ON "integration_connections"("integration_type");

-- CreateIndex
CREATE UNIQUE INDEX "banking_transactions_transaction_ref_key" ON "banking_transactions"("transaction_ref");

-- CreateIndex
CREATE INDEX "banking_transactions_status_idx" ON "banking_transactions"("status");

-- CreateIndex
CREATE INDEX "banking_transactions_pay_run_id_idx" ON "banking_transactions"("pay_run_id");

-- CreateIndex
CREATE INDEX "accounting_sync_queue_status_priority_idx" ON "accounting_sync_queue"("status", "priority");

-- CreateIndex
CREATE INDEX "pay_slips_pay_run_id_idx" ON "pay_slips"("pay_run_id");

-- CreateIndex
CREATE INDEX "pay_slips_employee_id_idx" ON "pay_slips"("employee_id");

-- CreateIndex
CREATE INDEX "employee_documents_employee_id_idx" ON "employee_documents"("employee_id");

-- CreateIndex
CREATE INDEX "data_import_jobs_tenant_id_dataset_type_status_idx" ON "data_import_jobs"("tenant_id", "dataset_type", "status");

-- CreateIndex
CREATE INDEX "data_import_jobs_uploaded_by_user_id_idx" ON "data_import_jobs"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "data_import_jobs_status_idx" ON "data_import_jobs"("status");

-- CreateIndex
CREATE INDEX "data_import_rows_job_id_status_idx" ON "data_import_rows"("job_id", "status");

-- CreateIndex
CREATE INDEX "data_import_rows_job_id_row_number_idx" ON "data_import_rows"("job_id", "row_number");

-- CreateIndex
CREATE INDEX "data_import_rows_external_key_idx" ON "data_import_rows"("external_key");

-- CreateIndex
CREATE UNIQUE INDEX "data_import_rows_job_id_sheet_name_sheet_row_number_key" ON "data_import_rows"("job_id", "sheet_name", "sheet_row_number");

-- CreateIndex
CREATE INDEX "data_import_errors_job_id_severity_idx" ON "data_import_errors"("job_id", "severity");

-- CreateIndex
CREATE INDEX "data_import_errors_row_id_idx" ON "data_import_errors"("row_id");

-- CreateIndex
CREATE INDEX "bootstrap_imports_created_by_idx" ON "bootstrap_imports"("created_by");

-- CreateIndex
CREATE INDEX "bootstrap_imports_status_idx" ON "bootstrap_imports"("status");

-- CreateIndex
CREATE INDEX "bootstrap_import_jobs_bootstrap_import_id_idx" ON "bootstrap_import_jobs"("bootstrap_import_id");

-- CreateIndex
CREATE INDEX "workforce_issues_tenant_id_entity_type_entity_id_idx" ON "workforce_issues"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "workforce_issues_tenant_id_issue_type_severity_idx" ON "workforce_issues"("tenant_id", "issue_type", "severity");

-- CreateIndex
CREATE INDEX "workforce_issues_tenant_id_legal_entity_id_idx" ON "workforce_issues"("tenant_id", "legal_entity_id");

-- CreateIndex
CREATE INDEX "workforce_issues_tenant_id_org_unit_id_idx" ON "workforce_issues"("tenant_id", "org_unit_id");

-- CreateIndex
CREATE INDEX "workforce_issues_tenant_id_employee_id_idx" ON "workforce_issues"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "workforce_issues_tenant_id_resolved_at_idx" ON "workforce_issues"("tenant_id", "resolved_at");

-- CreateIndex
CREATE INDEX "workforce_issues_tenant_id_assigned_user_id_idx" ON "workforce_issues"("tenant_id", "assigned_user_id");

-- CreateIndex
CREATE INDEX "workforce_issues_tenant_id_resolved_at_severity_detected_at_idx" ON "workforce_issues"("tenant_id", "resolved_at", "severity", "detected_at");

-- CreateIndex
CREATE INDEX "workforce_issues_tenant_id_resolved_at_blocks_export_idx" ON "workforce_issues"("tenant_id", "resolved_at", "blocks_export");

-- CreateIndex
CREATE UNIQUE INDEX "workforce_issues_tenant_id_entity_type_entity_id_issue_type_key" ON "workforce_issues"("tenant_id", "entity_type", "entity_id", "issue_type");

-- CreateIndex
CREATE INDEX "workforce_bulk_remediations_tenant_id_executed_at_idx" ON "workforce_bulk_remediations"("tenant_id", "executed_at");

-- CreateIndex
CREATE INDEX "workforce_bulk_remediations_user_id_idx" ON "workforce_bulk_remediations"("user_id");

-- CreateIndex
CREATE INDEX "workforce_bulk_remediations_action_type_idx" ON "workforce_bulk_remediations"("action_type");

-- CreateIndex
CREATE INDEX "workforce_remediation_approvals_tenant_id_status_idx" ON "workforce_remediation_approvals"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "workforce_remediation_approvals_requested_by_user_id_idx" ON "workforce_remediation_approvals"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "workforce_remediation_approvals_approver_user_id_idx" ON "workforce_remediation_approvals"("approver_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "overview_stats_snapshots_tenant_id_key" ON "overview_stats_snapshots"("tenant_id");

-- CreateIndex
CREATE INDEX "legal_entity_stats_snapshots_tenant_id_readiness_status_idx" ON "legal_entity_stats_snapshots"("tenant_id", "readiness_status");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entity_stats_snapshots_tenant_id_legal_entity_id_key" ON "legal_entity_stats_snapshots"("tenant_id", "legal_entity_id");

-- CreateIndex
CREATE INDEX "org_unit_stats_snapshots_tenant_id_legal_entity_id_idx" ON "org_unit_stats_snapshots"("tenant_id", "legal_entity_id");

-- CreateIndex
CREATE INDEX "org_unit_stats_snapshots_tenant_id_readiness_status_idx" ON "org_unit_stats_snapshots"("tenant_id", "readiness_status");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_stats_snapshots_tenant_id_org_unit_id_key" ON "org_unit_stats_snapshots"("tenant_id", "org_unit_id");

-- CreateIndex
CREATE INDEX "cost_center_stats_snapshots_tenant_id_legal_entity_id_idx" ON "cost_center_stats_snapshots"("tenant_id", "legal_entity_id");

-- CreateIndex
CREATE INDEX "cost_center_stats_snapshots_tenant_id_usage_status_idx" ON "cost_center_stats_snapshots"("tenant_id", "usage_status");

-- CreateIndex
CREATE UNIQUE INDEX "cost_center_stats_snapshots_tenant_id_cost_center_id_key" ON "cost_center_stats_snapshots"("tenant_id", "cost_center_id");

-- CreateIndex
CREATE INDEX "readiness_snapshots_tenant_id_legal_entity_id_idx" ON "readiness_snapshots"("tenant_id", "legal_entity_id");

-- CreateIndex
CREATE INDEX "readiness_snapshots_tenant_id_readiness_status_idx" ON "readiness_snapshots"("tenant_id", "readiness_status");

-- CreateIndex
CREATE UNIQUE INDEX "readiness_snapshots_tenant_id_entity_type_entity_id_key" ON "readiness_snapshots"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "org_unit_manager_suggestions_tenant_id_status_idx" ON "org_unit_manager_suggestions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "org_unit_manager_suggestions_org_unit_id_idx" ON "org_unit_manager_suggestions"("org_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_unit_manager_suggestions_tenant_id_org_unit_id_status_key" ON "org_unit_manager_suggestions"("tenant_id", "org_unit_id", "status");

-- CreateIndex
CREATE INDEX "payrun_exceptions_payrun_id_status_idx" ON "payrun_exceptions"("payrun_id", "status");

-- CreateIndex
CREATE INDEX "payrun_exceptions_payrun_id_severity_status_idx" ON "payrun_exceptions"("payrun_id", "severity", "status");

-- CreateIndex
CREATE INDEX "payrun_exceptions_employee_id_status_idx" ON "payrun_exceptions"("employee_id", "status");

-- CreateIndex
CREATE INDEX "payrun_exceptions_owner_user_id_status_idx" ON "payrun_exceptions"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "payrun_exceptions_type_status_idx" ON "payrun_exceptions"("type", "status");

-- CreateIndex
CREATE INDEX "payrun_exceptions_blocks_submission_status_idx" ON "payrun_exceptions"("blocks_submission", "status");

-- CreateIndex
CREATE INDEX "payrun_exceptions_blocks_payment_status_idx" ON "payrun_exceptions"("blocks_payment", "status");

-- CreateIndex
CREATE INDEX "payroll_compliance_reports_country_code_report_type_idx" ON "payroll_compliance_reports"("country_code", "report_type");

-- CreateIndex
CREATE INDEX "payroll_compliance_reports_payrun_id_idx" ON "payroll_compliance_reports"("payrun_id");

-- CreateIndex
CREATE INDEX "payroll_compliance_reports_status_idx" ON "payroll_compliance_reports"("status");

-- CreateIndex
CREATE INDEX "employee_payroll_opening_balances_employee_id_idx" ON "employee_payroll_opening_balances"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_payroll_opening_balances_employee_id_tax_year_key" ON "employee_payroll_opening_balances"("employee_id", "tax_year");

-- CreateIndex
CREATE INDEX "employee_leave_opening_balances_employee_id_idx" ON "employee_leave_opening_balances"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_opening_balances_employee_id_leave_type_as_o_key" ON "employee_leave_opening_balances"("employee_id", "leave_type", "as_of_date");

-- CreateIndex
CREATE INDEX "employee_loan_opening_balances_employee_id_idx" ON "employee_loan_opening_balances"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_loan_opening_balances_employee_id_deduction_code_a_key" ON "employee_loan_opening_balances"("employee_id", "deduction_code", "as_of_date");

-- CreateIndex
CREATE INDEX "statutory_returns_country_code_period_key_idx" ON "statutory_returns"("country_code", "period_key");

-- CreateIndex
CREATE INDEX "statutory_returns_legal_entity_id_return_code_idx" ON "statutory_returns"("legal_entity_id", "return_code");

-- CreateIndex
CREATE INDEX "statutory_returns_status_idx" ON "statutory_returns"("status");

-- CreateIndex
CREATE INDEX "statutory_returns_amends_return_id_idx" ON "statutory_returns"("amends_return_id");

-- CreateIndex
CREATE INDEX "statutory_return_items_statutory_return_id_idx" ON "statutory_return_items"("statutory_return_id");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_evidence_bundles_statutory_return_id_key" ON "statutory_evidence_bundles"("statutory_return_id");

-- CreateIndex
CREATE INDEX "statutory_workflow_events_statutory_return_id_idx" ON "statutory_workflow_events"("statutory_return_id");

-- CreateIndex
CREATE INDEX "tax_table_authoring_versions_country_code_table_type_tax_ye_idx" ON "tax_table_authoring_versions"("country_code", "table_type", "tax_year", "status");

-- CreateIndex
CREATE INDEX "tax_table_authoring_versions_country_code_table_type_effect_idx" ON "tax_table_authoring_versions"("country_code", "table_type", "effective_from");

-- CreateIndex
CREATE INDEX "tax_table_authoring_brackets_authoring_version_id_seq_no_idx" ON "tax_table_authoring_brackets"("authoring_version_id", "seq_no");

-- CreateIndex
CREATE INDEX "tax_table_authoring_fields_authoring_version_id_field_code_idx" ON "tax_table_authoring_fields"("authoring_version_id", "field_code");

-- CreateIndex
CREATE INDEX "tax_table_authoring_audit_events_authoring_version_id_creat_idx" ON "tax_table_authoring_audit_events"("authoring_version_id", "created_at");

-- CreateIndex
CREATE INDEX "tax_table_impact_analysis_runs_authoring_version_id_run_at_idx" ON "tax_table_impact_analysis_runs"("authoring_version_id", "run_at");

-- CreateIndex
CREATE INDEX "tax_table_impact_analysis_runs_country_code_run_at_idx" ON "tax_table_impact_analysis_runs"("country_code", "run_at");

-- CreateIndex
CREATE INDEX "tax_table_impact_analysis_row_snapshots_run_id_employee_id_idx" ON "tax_table_impact_analysis_row_snapshots"("run_id", "employee_id");

-- CreateIndex
CREATE INDEX "tax_table_impact_analysis_row_snapshots_run_id_direction_idx" ON "tax_table_impact_analysis_row_snapshots"("run_id", "direction");

-- CreateIndex
CREATE INDEX "tax_table_impact_analysis_reviews_authoring_version_id_revi_idx" ON "tax_table_impact_analysis_reviews"("authoring_version_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "tax_table_impact_analysis_reviews_impact_analysis_run_id_re_idx" ON "tax_table_impact_analysis_reviews"("impact_analysis_run_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "ctc_optimiser_runs_tenant_id_created_at_idx" ON "ctc_optimiser_runs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "ctc_optimiser_runs_employee_id_created_at_idx" ON "ctc_optimiser_runs"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "ctc_optimiser_runs_legal_entity_id_created_at_idx" ON "ctc_optimiser_runs"("legal_entity_id", "created_at");

-- CreateIndex
CREATE INDEX "ctc_optimiser_scenarios_run_id_rank_idx" ON "ctc_optimiser_scenarios"("run_id", "rank");

-- CreateIndex
CREATE INDEX "ctc_optimiser_decisions_run_id_created_at_idx" ON "ctc_optimiser_decisions"("run_id", "created_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_legal_entity_access" ADD CONSTRAINT "user_legal_entity_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_legal_entity_access" ADD CONSTRAINT "user_legal_entity_access_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parent_org_unit_id_fkey" FOREIGN KEY ("parent_org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_default_cost_center_id_fkey" FOREIGN KEY ("default_cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_groups" ADD CONSTRAINT "pay_groups_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_governance_policies" ADD CONSTRAINT "payroll_governance_policies_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_governance_policies" ADD CONSTRAINT "payroll_governance_policies_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_governance_policies" ADD CONSTRAINT "payroll_governance_policies_superseded_by_policy_id_fkey" FOREIGN KEY ("superseded_by_policy_id") REFERENCES "payroll_governance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_governance_policy_drafts" ADD CONSTRAINT "payroll_governance_policy_drafts_activation_policy_id_fkey" FOREIGN KEY ("activation_policy_id") REFERENCES "payroll_governance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employments" ADD CONSTRAINT "employments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employments" ADD CONSTRAINT "employments_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employments" ADD CONSTRAINT "employments_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_assignments" ADD CONSTRAINT "employment_assignments_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_assignments" ADD CONSTRAINT "employment_assignments_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_assignments" ADD CONSTRAINT "employment_assignments_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_assignments" ADD CONSTRAINT "employment_assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensations" ADD CONSTRAINT "compensations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_profiles" ADD CONSTRAINT "tax_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_items" ADD CONSTRAINT "pay_items_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_brackets" ADD CONSTRAINT "tax_brackets_tax_table_id_fkey" FOREIGN KEY ("tax_table_id") REFERENCES "tax_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payruns" ADD CONSTRAINT "payruns_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payruns" ADD CONSTRAINT "payruns_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "pay_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payruns" ADD CONSTRAINT "payruns_base_payrun_id_fkey" FOREIGN KEY ("base_payrun_id") REFERENCES "payruns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_reversal_workflows" ADD CONSTRAINT "payrun_reversal_workflows_source_payrun_id_fkey" FOREIGN KEY ("source_payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_reversal_workflows" ADD CONSTRAINT "payrun_reversal_workflows_reversal_payrun_id_fkey" FOREIGN KEY ("reversal_payrun_id") REFERENCES "payruns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_correction_approvals" ADD CONSTRAINT "payrun_correction_approvals_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_correction_approvals" ADD CONSTRAINT "payrun_correction_approvals_resulting_adjustment_payrun_id_fkey" FOREIGN KEY ("resulting_adjustment_payrun_id") REFERENCES "payruns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_contexts" ADD CONSTRAINT "payrun_contexts_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_employees" ADD CONSTRAINT "payrun_employees_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_employees" ADD CONSTRAINT "payrun_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_inputs" ADD CONSTRAINT "line_item_inputs_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_inputs" ADD CONSTRAINT "line_item_inputs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_inputs" ADD CONSTRAINT "line_item_inputs_pay_item_id_fkey" FOREIGN KEY ("pay_item_id") REFERENCES "pay_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_inputs" ADD CONSTRAINT "recurring_inputs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_inputs" ADD CONSTRAINT "recurring_inputs_pay_item_id_fkey" FOREIGN KEY ("pay_item_id") REFERENCES "pay_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_results" ADD CONSTRAINT "employee_results_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_results" ADD CONSTRAINT "employee_results_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_lines" ADD CONSTRAINT "pay_lines_employee_result_id_fkey" FOREIGN KEY ("employee_result_id") REFERENCES "employee_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_lines" ADD CONSTRAINT "pay_lines_pay_item_id_fkey" FOREIGN KEY ("pay_item_id") REFERENCES "pay_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_subject_entity_id_fkey" FOREIGN KEY ("subject_entity_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_levels" ADD CONSTRAINT "approval_levels_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_levels" ADD CONSTRAINT "approval_levels_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_levels" ADD CONSTRAINT "approval_levels_approver_role_id_fkey" FOREIGN KEY ("approver_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "approval_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_delegated_to_fkey" FOREIGN KEY ("delegated_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_acted_by_fkey" FOREIGN KEY ("acted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_groups" ADD CONSTRAINT "company_groups_parent_group_id_fkey" FOREIGN KEY ("parent_group_id") REFERENCES "company_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_group_members" ADD CONSTRAINT "company_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "company_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_parent_cost_center_id_fkey" FOREIGN KEY ("parent_cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_certificates" ADD CONSTRAINT "tax_certificates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "gl_journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_financial_controls" ADD CONSTRAINT "payrun_financial_controls_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_financial_controls" ADD CONSTRAINT "payrun_financial_controls_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_bank_reconciliations" ADD CONSTRAINT "payrun_bank_reconciliations_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_bank_reconciliations" ADD CONSTRAINT "payrun_bank_reconciliations_payment_batch_id_fkey" FOREIGN KEY ("payment_batch_id") REFERENCES "payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_gl_reconciliations" ADD CONSTRAINT "payrun_gl_reconciliations_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_accruals" ADD CONSTRAINT "leave_accruals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_accruals" ADD CONSTRAINT "leave_accruals_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_expiry_alerts" ADD CONSTRAINT "document_expiry_alerts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_reconciliations" ADD CONSTRAINT "payroll_reconciliations_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "pay_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_reconciliations" ADD CONSTRAINT "payroll_reconciliations_comparison_period_id_fkey" FOREIGN KEY ("comparison_period_id") REFERENCES "pay_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_reconciliations" ADD CONSTRAINT "payroll_reconciliations_reconciled_by_fkey" FOREIGN KEY ("reconciled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_reconciliation_items" ADD CONSTRAINT "payroll_reconciliation_items_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "payroll_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_exceptions" ADD CONSTRAINT "payroll_exceptions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "pay_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_exceptions" ADD CONSTRAINT "payroll_exceptions_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_exceptions" ADD CONSTRAINT "payroll_exceptions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_forecasts" ADD CONSTRAINT "payroll_forecasts_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_forecast_items" ADD CONSTRAINT "payroll_forecast_items_forecast_id_fkey" FOREIGN KEY ("forecast_id") REFERENCES "payroll_forecasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_checklist_template_items" ADD CONSTRAINT "payroll_checklist_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "payroll_checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_checklists" ADD CONSTRAINT "payroll_checklists_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "pay_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_checklists" ADD CONSTRAINT "payroll_checklists_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "payroll_checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_checklist_tasks" ADD CONSTRAINT "payroll_checklist_tasks_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "payroll_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_checklist_tasks" ADD CONSTRAINT "payroll_checklist_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_checklist_tasks" ADD CONSTRAINT "payroll_checklist_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_plan_options" ADD CONSTRAINT "benefit_plan_options_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "benefit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_rates" ADD CONSTRAINT "benefit_rates_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "benefit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_rates" ADD CONSTRAINT "benefit_rates_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "benefit_plan_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_benefits" ADD CONSTRAINT "employee_benefits_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_benefits" ADD CONSTRAINT "employee_benefits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "benefit_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_benefits" ADD CONSTRAINT "employee_benefits_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "benefit_plan_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_deductions" ADD CONSTRAINT "benefit_deductions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "employee_benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_enrollment_history" ADD CONSTRAINT "benefit_enrollment_history_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "employee_benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uif_declarations" ADD CONSTRAINT "uif_declarations_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uif_declaration_lines" ADD CONSTRAINT "uif_declaration_lines_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "uif_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdl_declarations" ADD CONSTRAINT "sdl_declarations_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdl_declaration_lines" ADD CONSTRAINT "sdl_declaration_lines_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "sdl_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coida_assessments" ADD CONSTRAINT "coida_assessments_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coida_assessment_lines" ADD CONSTRAINT "coida_assessment_lines_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "coida_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "mobile_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "irp5_certificates" ADD CONSTRAINT "irp5_certificates_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "irp5_certificates" ADD CONSTRAINT "irp5_certificates_tax_period_id_fkey" FOREIGN KEY ("tax_period_id") REFERENCES "tax_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "irp5_certificates" ADD CONSTRAINT "irp5_certificates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emp201_returns" ADD CONSTRAINT "emp201_returns_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emp201_returns" ADD CONSTRAINT "emp201_returns_tax_period_id_fkey" FOREIGN KEY ("tax_period_id") REFERENCES "tax_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emp501_reconciliations" ADD CONSTRAINT "emp501_reconciliations_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emp501_reconciliations" ADD CONSTRAINT "emp501_reconciliations_tax_period_id_fkey" FOREIGN KEY ("tax_period_id") REFERENCES "tax_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sars_validation_results" ADD CONSTRAINT "sars_validation_results_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "sars_validation_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sars_submissions" ADD CONSTRAINT "sars_submissions_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sars_submission_queue" ADD CONSTRAINT "sars_submission_queue_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "job_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "job_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_workflows" ADD CONSTRAINT "onboarding_workflows_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_workflows" ADD CONSTRAINT "onboarding_workflows_source_offer_id_fkey" FOREIGN KEY ("source_offer_id") REFERENCES "job_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "onboarding_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_documents" ADD CONSTRAINT "onboarding_documents_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "onboarding_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_assignment_id_fkey" FOREIGN KEY ("shift_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_feedback_provider_id_fkey" FOREIGN KEY ("feedback_provider_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "expense_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_loan_type_id_fkey" FOREIGN KEY ("loan_type_id") REFERENCES "loan_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "mobile_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "saved_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banking_transactions" ADD CONSTRAINT "banking_transactions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_slips" ADD CONSTRAINT "pay_slips_pay_run_id_fkey" FOREIGN KEY ("pay_run_id") REFERENCES "payruns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_slips" ADD CONSTRAINT "pay_slips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_rows" ADD CONSTRAINT "data_import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "data_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_errors" ADD CONSTRAINT "data_import_errors_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "data_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_errors" ADD CONSTRAINT "data_import_errors_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "data_import_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bootstrap_import_jobs" ADD CONSTRAINT "bootstrap_import_jobs_bootstrap_import_id_fkey" FOREIGN KEY ("bootstrap_import_id") REFERENCES "bootstrap_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workforce_bulk_remediations" ADD CONSTRAINT "workforce_bulk_remediations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workforce_remediation_approvals" ADD CONSTRAINT "workforce_remediation_approvals_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workforce_remediation_approvals" ADD CONSTRAINT "workforce_remediation_approvals_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_manager_suggestions" ADD CONSTRAINT "org_unit_manager_suggestions_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_exceptions" ADD CONSTRAINT "payrun_exceptions_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrun_exceptions" ADD CONSTRAINT "payrun_exceptions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_compliance_reports" ADD CONSTRAINT "payroll_compliance_reports_payrun_id_fkey" FOREIGN KEY ("payrun_id") REFERENCES "payruns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payroll_opening_balances" ADD CONSTRAINT "employee_payroll_opening_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_opening_balances" ADD CONSTRAINT "employee_leave_opening_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loan_opening_balances" ADD CONSTRAINT "employee_loan_opening_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_returns" ADD CONSTRAINT "statutory_returns_amends_return_id_fkey" FOREIGN KEY ("amends_return_id") REFERENCES "statutory_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_return_items" ADD CONSTRAINT "statutory_return_items_statutory_return_id_fkey" FOREIGN KEY ("statutory_return_id") REFERENCES "statutory_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_evidence_bundles" ADD CONSTRAINT "statutory_evidence_bundles_statutory_return_id_fkey" FOREIGN KEY ("statutory_return_id") REFERENCES "statutory_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_workflow_events" ADD CONSTRAINT "statutory_workflow_events_statutory_return_id_fkey" FOREIGN KEY ("statutory_return_id") REFERENCES "statutory_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_table_authoring_brackets" ADD CONSTRAINT "tax_table_authoring_brackets_authoring_version_id_fkey" FOREIGN KEY ("authoring_version_id") REFERENCES "tax_table_authoring_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_table_authoring_fields" ADD CONSTRAINT "tax_table_authoring_fields_authoring_version_id_fkey" FOREIGN KEY ("authoring_version_id") REFERENCES "tax_table_authoring_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_table_authoring_audit_events" ADD CONSTRAINT "tax_table_authoring_audit_events_authoring_version_id_fkey" FOREIGN KEY ("authoring_version_id") REFERENCES "tax_table_authoring_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_table_impact_analysis_row_snapshots" ADD CONSTRAINT "tax_table_impact_analysis_row_snapshots_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "tax_table_impact_analysis_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_table_impact_analysis_reviews" ADD CONSTRAINT "tax_table_impact_analysis_reviews_impact_analysis_run_id_fkey" FOREIGN KEY ("impact_analysis_run_id") REFERENCES "tax_table_impact_analysis_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctc_optimiser_scenarios" ADD CONSTRAINT "ctc_optimiser_scenarios_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ctc_optimiser_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctc_optimiser_decisions" ADD CONSTRAINT "ctc_optimiser_decisions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ctc_optimiser_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

