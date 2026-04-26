import { ApiProperty } from '@nestjs/swagger';
import { RateType } from './create-engagement.dto';

export class EngagementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  contractorId: string;

  @ApiProperty()
  contractId: string;

  @ApiProperty({ required: false })
  projectId?: string;

  @ApiProperty({ required: false })
  costCenterId?: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty({ enum: RateType })
  rateType: string;

  @ApiProperty()
  rateAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ required: false })
  currentClassificationId?: string;

  @ApiProperty()
  isActive: boolean;

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

  @ApiProperty({ required: false })
  contract?: {
    id: string;
    contractNumber: string;
    title: string;
  };

  @ApiProperty({ required: false })
  project?: {
    id: string;
    code: string;
    name: string;
  };
}

export class PaginatedEngagementResponseDto {
  @ApiProperty({ type: [EngagementResponseDto] })
  data: EngagementResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
