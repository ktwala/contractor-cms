import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  WorkerClassification,
  EngagementModel,
  SupplierType,
  ContractorPersonType,
  ContractorAccessIntent,
  IgaIntegrationPlaneStatus,
  AccessEnablementPlaneStatus,
  GovernanceRiskTier,
  WorkerArchetypeKind,
} from '@prisma/client';

export class ContractorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  supplierId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ required: false })
  idNumber?: string;

  @ApiProperty({ required: false })
  passportNumber?: string;

  @ApiProperty({ enum: WorkerClassification })
  workerClassification: WorkerClassification;

  @ApiProperty({ enum: EngagementModel })
  engagementModel: EngagementModel;

  @ApiProperty({ required: false })
  taxNumber?: string;

  @ApiProperty()
  taxResidency: string;

  @ApiProperty({ required: false })
  dateOfBirth?: Date;

  @ApiProperty({ type: [String] })
  skills: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  accessExpiresAt?: Date;

  @ApiPropertyOptional()
  externalPersonId?: string | null;

  @ApiPropertyOptional({ enum: ContractorPersonType, enumName: 'ContractorPersonType' })
  personType?: ContractorPersonType | null;

  @ApiPropertyOptional()
  supplierResourceId?: string | null;

  @ApiPropertyOptional({ enum: ContractorAccessIntent, enumName: 'ContractorAccessIntent' })
  accessIntent?: ContractorAccessIntent | null;

  @ApiPropertyOptional()
  identityRequired?: boolean;

  @ApiPropertyOptional()
  physicalAccessRequired?: boolean;

  @ApiPropertyOptional()
  logicalAccessRequired?: boolean;

  @ApiPropertyOptional({
    enum: IgaIntegrationPlaneStatus,
    enumName: 'IgaIntegrationPlaneStatus',
  })
  igaIntegrationStatus?: IgaIntegrationPlaneStatus;

  @ApiPropertyOptional({
    enum: AccessEnablementPlaneStatus,
    enumName: 'AccessEnablementPlaneStatus',
  })
  accessEnablementStatus?: AccessEnablementPlaneStatus;

  @ApiPropertyOptional()
  igaLastSyncAt?: Date | null;

  @ApiPropertyOptional({ enum: GovernanceRiskTier, enumName: 'GovernanceRiskTier' })
  riskTier?: GovernanceRiskTier | null;

  @ApiPropertyOptional({ enum: WorkerArchetypeKind, enumName: 'WorkerArchetypeKind' })
  workerArchetype?: WorkerArchetypeKind | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  supplier?: {
    id: string;
    type: SupplierType;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export class PaginatedContractorResponseDto {
  @ApiProperty({ type: [ContractorResponseDto] })
  data: ContractorResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
