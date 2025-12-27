import { ApiProperty } from '@nestjs/swagger';
import { TaxClassification, WithholdingType } from './create-withholding.dto';
import { SyncStatus } from './update-withholding.dto';

export class WithholdingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  contractorId: string;

  @ApiProperty()
  taxClassificationId: string;

  @ApiProperty()
  instructionNumber: string;

  @ApiProperty()
  effectiveDate: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty({ required: false })
  workerExternalId?: string;

  @ApiProperty()
  workerName: string;

  @ApiProperty({ required: false })
  workerTaxNumber?: string;

  @ApiProperty()
  supplierName: string;

  @ApiProperty({ required: false })
  supplierTaxNumber?: string;

  @ApiProperty({ enum: WithholdingType })
  withholdingType: string;

  @ApiProperty()
  taxYear: number;

  @ApiProperty()
  grossAmount: number;

  @ApiProperty()
  withholdingAmount: number;

  @ApiProperty()
  netAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: TaxClassification })
  classification: TaxClassification;

  @ApiProperty({ required: false })
  riskScore?: number;

  @ApiProperty({ required: false })
  dominantImpression?: string;

  @ApiProperty()
  canonicalPayload: Record<string, any>;

  @ApiProperty({ required: false })
  adapterType?: string;

  @ApiProperty({ required: false })
  externalReference?: string;

  @ApiProperty({ enum: SyncStatus })
  syncStatus: string;

  @ApiProperty({ required: false })
  syncedAt?: Date;

  @ApiProperty({ required: false })
  syncError?: string;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  contractor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export class PaginatedWithholdingResponseDto {
  @ApiProperty({ type: [WithholdingResponseDto] })
  data: WithholdingResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
