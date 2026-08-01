-- PR-SPONSOR-TASKS-1 — sponsor accountability task inbox (scoped by responsibleManagerEmployeeId)

CREATE TYPE "ResponsibleManagerTaskType" AS ENUM (
  'ACCESS_NEED_CONFIRMATION',
  'CERTIFICATION_READINESS',
  'RENEWAL_REVIEW',
  'OFFBOARDING_PROMPT'
);

CREATE TYPE "ResponsibleManagerTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'DISMISSED');

CREATE TABLE "ResponsibleManagerAccountabilityTask" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "contractorId" TEXT NOT NULL,
  "responsibleManagerEmployeeId" TEXT NOT NULL,
  "taskType" "ResponsibleManagerTaskType" NOT NULL,
  "status" "ResponsibleManagerTaskStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedByUserId" TEXT,
  "outcome" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResponsibleManagerAccountabilityTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResponsibleManagerAccountabilityTask_responsibleManagerEmployeeId_status_idx"
  ON "ResponsibleManagerAccountabilityTask"("responsibleManagerEmployeeId", "status");
CREATE INDEX "ResponsibleManagerAccountabilityTask_engagementId_taskType_idx"
  ON "ResponsibleManagerAccountabilityTask"("engagementId", "taskType");
CREATE INDEX "ResponsibleManagerAccountabilityTask_organizationId_idx"
  ON "ResponsibleManagerAccountabilityTask"("organizationId");

ALTER TABLE "ResponsibleManagerAccountabilityTask"
  ADD CONSTRAINT "ResponsibleManagerAccountabilityTask_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResponsibleManagerAccountabilityTask"
  ADD CONSTRAINT "ResponsibleManagerAccountabilityTask_engagementId_fkey"
  FOREIGN KEY ("engagementId") REFERENCES "ContractorEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
