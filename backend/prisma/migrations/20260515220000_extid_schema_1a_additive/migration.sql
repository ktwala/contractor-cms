-- PR-EXTID-SCHEMA-1A — additive substrate (identity, access intent, IGA boundary, governance; sponsor on engagement)

CREATE TYPE "ContractorPersonType" AS ENUM ('PERSON_SUPPLIED_WORKER', 'PERSON_INDEPENDENT');

CREATE TYPE "ContractorAccessIntent" AS ENUM ('ACCESS_NONE', 'ACCESS_LOGICAL', 'ACCESS_PHYSICAL', 'ACCESS_BOTH', 'ACCESS_PRIVILEGED');

CREATE TYPE "IgaIntegrationPlaneStatus" AS ENUM ('IGA_UNKNOWN', 'IGA_NOT_CONNECTED', 'IGA_PENDING', 'IGA_SYNCED', 'IGA_FAILED');

CREATE TYPE "AccessEnablementPlaneStatus" AS ENUM ('ENABLEMENT_NOT_REQUIRED', 'ENABLEMENT_PENDING_IGA', 'ENABLEMENT_PARTIAL', 'ENABLEMENT_ENABLED', 'ENABLEMENT_BLOCKED', 'ENABLEMENT_REVOKED');

CREATE TYPE "ResponsibleManagerAccountabilityStatus" AS ENUM ('RESPONSIBLE_MANAGER_ACTIVE', 'RESPONSIBLE_MANAGER_TRANSFER_PENDING', 'RESPONSIBLE_MANAGER_REVOKED');

CREATE TYPE "GovernanceRiskTier" AS ENUM ('RISK_UNKNOWN', 'RISK_LOW', 'RISK_MEDIUM', 'RISK_HIGH');

CREATE TYPE "WorkerArchetypeKind" AS ENUM ('ARCHETYPE_UNKNOWN', 'ARCHETYPE_SUPPLIED', 'ARCHETYPE_INDEPENDENT');

ALTER TABLE "Contractor" ADD COLUMN "externalPersonId" TEXT,
ADD COLUMN "personType" "ContractorPersonType",
ADD COLUMN "supplierResourceId" TEXT,
ADD COLUMN "accessIntent" "ContractorAccessIntent",
ADD COLUMN "identityRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "physicalAccessRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "logicalAccessRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "igaIntegrationStatus" "IgaIntegrationPlaneStatus" NOT NULL DEFAULT 'IGA_UNKNOWN'::"IgaIntegrationPlaneStatus",
ADD COLUMN "accessEnablementStatus" "AccessEnablementPlaneStatus" NOT NULL DEFAULT 'ENABLEMENT_NOT_REQUIRED'::"AccessEnablementPlaneStatus",
ADD COLUMN "igaLastSyncAt" TIMESTAMP(3),
ADD COLUMN "riskTier" "GovernanceRiskTier",
ADD COLUMN "workerArchetype" "WorkerArchetypeKind";

ALTER TABLE "ContractorEngagement" ADD COLUMN "responsibleManagerEmployeeId" TEXT,
ADD COLUMN "responsibleManagerDelegateEmployeeId" TEXT,
ADD COLUMN "responsibleManagerStatus" "ResponsibleManagerAccountabilityStatus";
