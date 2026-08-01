-- PR-SUPPLIER-SCOPING-1: bind supplier-portal users to a single supplier scope
-- PR-DB-MIGRATION-REPAIR: idempotent DDL (safe after partial apply or db push drift)

DO $$ BEGIN
  CREATE TYPE "SupplierMembershipRole" AS ENUM ('ADMIN', 'MANAGER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SupplierMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "role" "SupplierMembershipRole" NOT NULL DEFAULT 'MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierMembership_userId_supplierId_key"
  ON "SupplierMembership"("userId", "supplierId");
CREATE INDEX IF NOT EXISTS "SupplierMembership_userId_idx"
  ON "SupplierMembership"("userId");
CREATE INDEX IF NOT EXISTS "SupplierMembership_supplierId_idx"
  ON "SupplierMembership"("supplierId");

DO $$ BEGIN
  ALTER TABLE "SupplierMembership"
    ADD CONSTRAINT "SupplierMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierMembership"
    ADD CONSTRAINT "SupplierMembership_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
