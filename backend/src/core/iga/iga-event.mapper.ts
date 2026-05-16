import type {
  ContractorAccessIntent,
  ContractorPersonType,
  GovernanceRiskTier,
  IgaIntegrationPlaneStatus,
  WorkerArchetypeKind,
} from '@prisma/client';
import type { IgaEventContractorSlice } from './iga-event.builder';

/** Map a contractor row (or select slice) to the IGA event builder input. */
export function toIgaEventContractorSlice(row: {
  id: string;
  supplierId: string;
  externalPersonId: string | null;
  personType: ContractorPersonType | null;
  workerArchetype: WorkerArchetypeKind | null;
  accessIntent: ContractorAccessIntent | null;
  riskTier: GovernanceRiskTier | null;
  igaIntegrationStatus: IgaIntegrationPlaneStatus;
}): IgaEventContractorSlice {
  return {
    id: row.id,
    supplierId: row.supplierId,
    externalPersonId: row.externalPersonId,
    personType: row.personType,
    workerArchetype: row.workerArchetype,
    accessIntent: row.accessIntent,
    riskTier: row.riskTier,
    igaIntegrationStatus: row.igaIntegrationStatus,
  };
}
