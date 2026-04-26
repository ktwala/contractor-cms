import { ApiProperty } from '@nestjs/swagger';
import { TaxClassification, ClassificationBasis } from './create-tax-classification.dto';

export class TaxClassificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  contractorId: string;

  @ApiProperty({ required: false })
  engagementId?: string;

  @ApiProperty({ enum: TaxClassification })
  classification: TaxClassification;

  @ApiProperty({ enum: ClassificationBasis })
  basis: ClassificationBasis;

  @ApiProperty()
  assessmentPayload: Record<string, any>;

  @ApiProperty({ required: false })
  dominantImpression?: string;

  @ApiProperty({ required: false })
  riskScore?: number;

  @ApiProperty()
  assessedBy: string;

  @ApiProperty()
  assessedAt: Date;

  @ApiProperty({ required: false })
  approvedBy?: string;

  @ApiProperty({ required: false })
  approvedAt?: Date;

  @ApiProperty()
  validFrom: Date;

  @ApiProperty({ required: false })
  validTo?: Date;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  contractor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export class PaginatedTaxClassificationResponseDto {
  @ApiProperty({ type: [TaxClassificationResponseDto] })
  data: TaxClassificationResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
