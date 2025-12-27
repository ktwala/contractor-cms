import { ApiProperty } from '@nestjs/swagger';
import { WorkerClassification, EngagementModel } from '@prisma/client';

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
