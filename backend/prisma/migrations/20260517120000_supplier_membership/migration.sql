-- PR-SUPPLIER-SCOPING-1: bind supplier-portal users to a single supplier scope
CREATE TYPE "SupplierMembershipRole" AS ENUM ('ADMIN', 'MANAGER');

CREATE TABLE "SupplierMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "role" "SupplierMembershipRole" NOT NULL DEFAULT 'MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierMembership_userId_supplierId_key" ON "SupplierMembership"("userId", "supplierId");
CREATE INDEX "SupplierMembership_userId_idx" ON "SupplierMembership"("userId");
CREATE INDEX "SupplierMembership_supplierId_idx" ON "SupplierMembership"("supplierId");

ALTER TABLE "SupplierMembership" ADD CONSTRAINT "SupplierMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierMembership" ADD CONSTRAINT "SupplierMembership_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
