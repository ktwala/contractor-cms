-- Workforce assessment consumes a discovery snapshot — track last assessed discovery run per org.
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "workforceLastAssessedDiscoveryRunId" TEXT,
  ADD COLUMN IF NOT EXISTS "workforceLastAssessedAt" TIMESTAMP(3);
