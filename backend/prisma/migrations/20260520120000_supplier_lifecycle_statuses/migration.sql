-- PR-CMS-OPERATIONS-1A — supplier lifecycle statuses (OFFBOARDED not TERMINATED)

CREATE TYPE "SupplierStatus_new" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'OFFBOARDED',
  'ARCHIVED'
);

ALTER TABLE "Supplier" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Supplier" ALTER COLUMN "status" TYPE "SupplierStatus_new" USING (
  CASE "status"::text
    WHEN 'TERMINATED' THEN 'OFFBOARDED'::"SupplierStatus_new"
    WHEN 'PENDING_APPROVAL' THEN 'PENDING_APPROVAL'::"SupplierStatus_new"
    WHEN 'ACTIVE' THEN 'ACTIVE'::"SupplierStatus_new"
    WHEN 'SUSPENDED' THEN 'SUSPENDED'::"SupplierStatus_new"
    ELSE 'PENDING_APPROVAL'::"SupplierStatus_new"
  END
);

DROP TYPE "SupplierStatus";

ALTER TYPE "SupplierStatus_new" RENAME TO "SupplierStatus";

ALTER TABLE "Supplier" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';
