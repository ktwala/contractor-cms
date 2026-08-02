/**
 * Frontend transport type for the contractor API response.
 *
 * Mirrors the serialized JSON contract of backend ContractorResponseDto
 * without importing backend classes. This is the boundary between the
 * API layer and page-level view models.
 */

// ---------------------------------------------------------------------------
// Enum string unions (match Prisma schema values as serialized to JSON)
// ---------------------------------------------------------------------------

export type AcquisitionModel = 'SUPPLIER' | 'INDEPENDENT';

export type WorkerClassification =
  | 'SUPPLIER_CONTRACTOR'
  | 'INDEPENDENT_CONTRACTOR'
  | 'CONSULTANT'
  | 'TEMPORARY_WORKER'
  | 'PROFESSIONAL_SERVICES'
  | 'OTHER';

export type EngagementModel = 'DIRECT' | 'AGENCY';

export type ContractorWorkforceState =
  | 'NOMINATED'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'BLACKLISTED';

export type ContractorPersonType =
  | 'PERSON_SUPPLIED_WORKER'
  | 'PERSON_INDEPENDENT';

export type ContractorAccessIntent =
  | 'ACCESS_NONE'
  | 'ACCESS_LOGICAL'
  | 'ACCESS_PHYSICAL'
  | 'ACCESS_BOTH'
  | 'ACCESS_PRIVILEGED';

export type IgaIntegrationPlaneStatus =
  | 'IGA_UNKNOWN'
  | 'IGA_NOT_CONNECTED'
  | 'IGA_PENDING'
  | 'IGA_SYNCED'
  | 'IGA_FAILED';

export type AccessEnablementPlaneStatus =
  | 'ENABLEMENT_NOT_REQUIRED'
  | 'ENABLEMENT_PENDING_IGA'
  | 'ENABLEMENT_PARTIAL'
  | 'ENABLEMENT_ENABLED'
  | 'ENABLEMENT_BLOCKED'
  | 'ENABLEMENT_REVOKED';

export type GovernanceRiskTier =
  | 'RISK_UNKNOWN'
  | 'RISK_LOW'
  | 'RISK_MEDIUM'
  | 'RISK_HIGH';

export type WorkerArchetypeKind =
  | 'ARCHETYPE_UNKNOWN'
  | 'ARCHETYPE_SUPPLIED'
  | 'ARCHETYPE_INDEPENDENT';

export type SupplierType = 'COMPANY' | 'INDIVIDUAL';

// ---------------------------------------------------------------------------
// API response interface
// ---------------------------------------------------------------------------

export interface ContractorApiResponse {
  id: string;
  supplierId?: string | null;
  acquisitionModel: AcquisitionModel;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  idNumber?: string;
  passportNumber?: string;
  workerClassification: WorkerClassification;
  engagementModel: EngagementModel;
  taxNumber?: string;
  taxResidency: string;
  dateOfBirth?: string;
  skills: string[];
  isActive: boolean;
  workforceState: ContractorWorkforceState;
  accessExpiresAt?: string;
  externalPersonId?: string | null;
  personType?: ContractorPersonType | null;
  supplierResourceId?: string | null;
  accessIntent?: ContractorAccessIntent | null;
  identityRequired?: boolean;
  physicalAccessRequired?: boolean;
  logicalAccessRequired?: boolean;
  igaIntegrationStatus?: IgaIntegrationPlaneStatus;
  accessEnablementStatus?: AccessEnablementPlaneStatus;
  igaLastSyncAt?: string | null;
  riskTier?: GovernanceRiskTier | null;
  workerArchetype?: WorkerArchetypeKind | null;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    type: SupplierType;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}
