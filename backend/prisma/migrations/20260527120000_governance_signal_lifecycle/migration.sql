-- PR-GOV-SIGNAL-LIFECYCLE-1 — bootstrap vs operational governance signal lifecycle

CREATE TYPE "GovernanceSignalCategory" AS ENUM ('BOOTSTRAP', 'OPERATIONAL');
CREATE TYPE "GovernanceOperationalImpact" AS ENUM ('NONE', 'LIMITED', 'ACTIVE');
CREATE TYPE "GovernanceSignalOwner" AS ENUM ('MIGRATION', 'OPERATIONS');

ALTER TABLE "Organization"
  ADD COLUMN "workforceMigrationCutoverAt" TIMESTAMP(3);

ALTER TABLE "contractor_source_drifts"
  ADD COLUMN "signalCategory" "GovernanceSignalCategory" NOT NULL DEFAULT 'OPERATIONAL',
  ADD COLUMN "detectedPhase" "GovernanceSignalCategory" NOT NULL DEFAULT 'OPERATIONAL',
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "suppressAfterCutover" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lineageOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "operationalImpact" "GovernanceOperationalImpact" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "governanceOwner" "GovernanceSignalOwner" NOT NULL DEFAULT 'OPERATIONS';

CREATE INDEX "contractor_source_drifts_organizationId_signalCategory_status_idx"
  ON "contractor_source_drifts"("organizationId", "signalCategory", "status");

CREATE INDEX "contractor_source_drifts_expiresAt_idx"
  ON "contractor_source_drifts"("expiresAt");
