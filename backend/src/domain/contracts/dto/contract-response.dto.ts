import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '@prisma/client';

export class ContractResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  supplierId: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  contractNumber: string;

  @ApiProperty({ enum: ContractType })
  contractType: ContractType;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty()
  currency: string;

  @ApiProperty({ required: false })
  totalValue?: number;

  @ApiProperty({ required: false })
  rateCard?: Record<string, any>;

  @ApiProperty()
  paymentTermsDays: number;

  @ApiProperty({ required: false })
  noticePeriodDays?: number;

  @ApiProperty({ required: false })
  slaTerms?: Record<string, any>;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  signedAt?: Date;

  @ApiProperty({ required: false })
  signedBy?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  supplier?: {
    id: string;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export class PaginatedContractResponseDto {
  @ApiProperty({ type: [ContractResponseDto] })
  data: ContractResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
