-- PR-WORKFORCE-TIMELINE-FOUNDATION-1 — workforce business history (transitions, not audit)

CREATE TYPE "ContractorWorkforceHistorySource" AS ENUM (
  'SUPPLIER_PORTAL',
  'OPS',
  'HCM_BOOTSTRAP',
  'HCM_SYNC',
  'SYSTEM',
  'LEGACY_BRIDGE'
);

CREATE TABLE "ContractorWorkforceHistory" (
  "id" TEXT NOT NULL,
  "contractorId" TEXT NOT NULL,
  "organizationId" TEXT,
  "fromState" "ContractorWorkforceState",
  "toState" "ContractorWorkforceState" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveAt" TIMESTAMP(3),
  "actorUserId" TEXT,
  "reason" TEXT,
  "source" "ContractorWorkforceHistorySource" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContractorWorkforceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractorWorkforceHistory_contractorId_occurredAt_idx"
  ON "ContractorWorkforceHistory"("contractorId", "occurredAt");

CREATE INDEX "ContractorWorkforceHistory_contractorId_toState_idx"
  ON "ContractorWorkforceHistory"("contractorId", "toState");

ALTER TABLE "ContractorWorkforceHistory"
  ADD CONSTRAINT "ContractorWorkforceHistory_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
