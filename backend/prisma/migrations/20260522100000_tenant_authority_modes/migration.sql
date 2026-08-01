-- PR-CMS-AUTHORITY-1 — tenant authority modes (governance constitution)

CREATE TYPE "SupplierAuthorityMode" AS ENUM ('CMS_ONLY', 'ORACLE_ONLY', 'HYBRID');
CREATE TYPE "ContractorAuthorityMode" AS ENUM ('CMS_ONLY', 'HCM_ONLY', 'HYBRID');

ALTER TABLE "Organization"
  ADD COLUMN "supplierAuthorityMode" "SupplierAuthorityMode" NOT NULL DEFAULT 'CMS_ONLY',
  ADD COLUMN "contractorAuthorityMode" "ContractorAuthorityMode" NOT NULL DEFAULT 'CMS_ONLY';
