import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EngagementModel, WorkerClassification } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

/** Supplier-scoped contractor create — supplierId is injected from membership scope. */
export class SupplierPortalCreateContractorDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    enum: WorkerClassification,
    default: WorkerClassification.INDEPENDENT_CONTRACTOR,
  })
  @IsEnum(WorkerClassification)
  workerClassification: WorkerClassification;

  @ApiProperty({ enum: EngagementModel, default: EngagementModel.DIRECT })
  @IsEnum(EngagementModel)
  engagementModel: EngagementModel;

  @ApiProperty({ description: 'Tax residency country code', default: 'ZA' })
  @IsString()
  taxResidency: string;
}
