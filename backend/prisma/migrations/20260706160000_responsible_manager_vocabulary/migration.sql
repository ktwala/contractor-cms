-- Responsible manager vocabulary rename (pre-production full rename)

-- Enum type renames
ALTER TYPE "SponsorAccountabilityStatus" RENAME TO "ResponsibleManagerAccountabilityStatus";
ALTER TYPE "ResponsibleManagerAccountabilityStatus" RENAME VALUE 'SPONSOR_ASSIGNED' TO 'RESPONSIBLE_MANAGER_ASSIGNED';
ALTER TYPE "ResponsibleManagerAccountabilityStatus" RENAME VALUE 'SPONSOR_ACTIVE' TO 'RESPONSIBLE_MANAGER_ACTIVE';
ALTER TYPE "ResponsibleManagerAccountabilityStatus" RENAME VALUE 'SPONSOR_TRANSFER_PENDING' TO 'RESPONSIBLE_MANAGER_TRANSFER_PENDING';
ALTER TYPE "ResponsibleManagerAccountabilityStatus" RENAME VALUE 'SPONSOR_REVOKED' TO 'RESPONSIBLE_MANAGER_REVOKED';

ALTER TYPE "SponsorTaskType" RENAME TO "ResponsibleManagerTaskType";
ALTER TYPE "SponsorTaskStatus" RENAME TO "ResponsibleManagerTaskStatus";

ALTER TYPE "HcmSponsorValidationStatus" RENAME TO "HcmResponsibleManagerValidationStatus";

ALTER TYPE "HcmQuarantineReasonCode" RENAME VALUE 'MISSING_SPONSOR' TO 'MISSING_RESPONSIBLE_MANAGER';
ALTER TYPE "HcmQuarantineReasonCode" RENAME VALUE 'INACTIVE_SPONSOR' TO 'INACTIVE_RESPONSIBLE_MANAGER';

ALTER TYPE "ContractorSourceDriftType" RENAME VALUE 'UNSPONSORED_CONTRACTOR' TO 'MISSING_RESPONSIBLE_MANAGER';

-- ContractorEngagement column renames
ALTER TABLE "ContractorEngagement" RENAME COLUMN "sponsorEmployeeId" TO "responsibleManagerEmployeeId";
ALTER TABLE "ContractorEngagement" RENAME COLUMN "sponsorDelegateEmployeeId" TO "responsibleManagerDelegateEmployeeId";
ALTER TABLE "ContractorEngagement" RENAME COLUMN "sponsorStatus" TO "responsibleManagerStatus";
ALTER TABLE "ContractorEngagement" RENAME COLUMN "sponsorValidationStatus" TO "responsibleManagerValidationStatus";

-- HCM staging column rename
ALTER TABLE "hcm_contractor_staging" RENAME COLUMN "sponsorValidationStatus" TO "responsibleManagerValidationStatus";

-- Sponsor accountability tasks table → responsible_manager_accountability_tasks
ALTER TABLE "SponsorAccountabilityTask" RENAME TO "responsible_manager_accountability_tasks";
ALTER TABLE "responsible_manager_accountability_tasks" RENAME COLUMN "sponsorEmployeeId" TO "responsibleManagerEmployeeId";

-- Index renames (PostgreSQL auto-renames some; explicit for clarity)
ALTER INDEX IF EXISTS "SponsorAccountabilityTask_sponsorEmployeeId_status_idx"
  RENAME TO "responsible_manager_accountability_tasks_responsibleManagerEmployeeId_status_idx";
ALTER INDEX IF EXISTS "SponsorAccountabilityTask_engagementId_taskType_idx"
  RENAME TO "responsible_manager_accountability_tasks_engagementId_taskType_idx";
ALTER INDEX IF EXISTS "SponsorAccountabilityTask_organizationId_idx"
  RENAME TO "responsible_manager_accountability_tasks_organizationId_idx";

-- Primary key / FK constraint renames
ALTER TABLE "responsible_manager_accountability_tasks"
  RENAME CONSTRAINT "SponsorAccountabilityTask_pkey" TO "responsible_manager_accountability_tasks_pkey";
ALTER TABLE "responsible_manager_accountability_tasks"
  RENAME CONSTRAINT "SponsorAccountabilityTask_organizationId_fkey" TO "responsible_manager_accountability_tasks_organizationId_fkey";
ALTER TABLE "responsible_manager_accountability_tasks"
  RENAME CONSTRAINT "SponsorAccountabilityTask_engagementId_fkey" TO "responsible_manager_accountability_tasks_engagementId_fkey";
