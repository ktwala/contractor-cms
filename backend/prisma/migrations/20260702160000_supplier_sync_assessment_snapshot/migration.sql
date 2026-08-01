-- Supplier readiness assessment consumes a sync snapshot — track last assessed sync run per org.
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "supplierLastAssessedSyncRunId" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierLastAssessedAt" TIMESTAMP(3);
