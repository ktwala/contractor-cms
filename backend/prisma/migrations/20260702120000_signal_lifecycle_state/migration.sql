-- PR-GOV-SIGNAL-LIFECYCLE-3 — temporal decay lifecycle columns on contractor_source_drifts

CREATE TYPE "SignalLifecycleState" AS ENUM ('ACTIVE', 'DECAYING', 'ARCHIVED');

ALTER TABLE "contractor_source_drifts"
  ADD COLUMN "signalLifecycleState" "SignalLifecycleState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "decayStartedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedReason" TEXT,
  ADD COLUMN "retentionUntil" TIMESTAMP(3);

CREATE INDEX "contractor_source_drifts_organizationId_signalCategory_signalLifecycleState_idx"
  ON "contractor_source_drifts"("organizationId", "signalCategory", "signalLifecycleState");

CREATE INDEX "contractor_source_drifts_signalLifecycleState_suppressAfterCutover_idx"
  ON "contractor_source_drifts"("signalLifecycleState", "suppressAfterCutover");
