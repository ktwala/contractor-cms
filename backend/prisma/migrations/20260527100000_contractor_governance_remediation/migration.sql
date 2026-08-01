-- PR-CTR-CONNECTOR-1G — contractor governance remediation workflows

CREATE TYPE "ContractorGovernanceRemediationType" AS ENUM (
  'PDP_RESTRICTION',
  'ACCESS_REVIEW_REQUIRED',
  'CORRELATION_REVIEW',
  'SUPPLIER_LINK_REPAIR',
  'TERMINATION_VALIDATION'
);

CREATE TYPE "ContractorGovernanceRemediationStatus" AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'REMEDIATION_IN_PROGRESS',
  'VERIFIED',
  'CLOSED'
);

CREATE TABLE "contractor_governance_remediations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "driftId" TEXT NOT NULL,
  "contractorId" TEXT,
  "remediationType" "ContractorGovernanceRemediationType" NOT NULL,
  "remediationStatus" "ContractorGovernanceRemediationStatus" NOT NULL DEFAULT 'OPEN',
  "assignedToUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  "downstreamActions" JSONB,
  "pdpRestrictionsApplied" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "auditTrail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contractor_governance_remediations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contractor_governance_remediations_driftId_key"
  ON "contractor_governance_remediations"("driftId");

CREATE INDEX "contractor_governance_remediations_organizationId_remediationStatus_idx"
  ON "contractor_governance_remediations"("organizationId", "remediationStatus");

CREATE INDEX "contractor_governance_remediations_organizationId_remediationType_idx"
  ON "contractor_governance_remediations"("organizationId", "remediationType");

CREATE INDEX "contractor_governance_remediations_contractorId_idx"
  ON "contractor_governance_remediations"("contractorId");

CREATE INDEX "contractor_governance_remediations_dueAt_idx"
  ON "contractor_governance_remediations"("dueAt");

ALTER TABLE "contractor_governance_remediations"
  ADD CONSTRAINT "contractor_governance_remediations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contractor_governance_remediations"
  ADD CONSTRAINT "contractor_governance_remediations_driftId_fkey"
  FOREIGN KEY ("driftId") REFERENCES "contractor_source_drifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contractor_governance_remediations"
  ADD CONSTRAINT "contractor_governance_remediations_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contractor_governance_remediations"
  ADD CONSTRAINT "contractor_governance_remediations_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
