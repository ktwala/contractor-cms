import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EngagementModel, WorkerClassification } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SupplierPortalNominateEngagementDto } from './supplier-portal-nominate-engagement.dto';

/** Supplier-scoped workforce nomination — supplierId injected from membership; enters NOMINATED. */
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
    default: WorkerClassification.SUPPLIER_CONTRACTOR,
    description: 'Vendor-linked workforce — defaults to Supplier Contractor in supplier portal.',
  })
  @IsEnum(WorkerClassification)
  workerClassification: WorkerClassification;

  @ApiProperty({ enum: EngagementModel, default: EngagementModel.DIRECT })
  @IsEnum(EngagementModel)
  engagementModel: EngagementModel;

  @ApiProperty({ description: 'Tax residency country code', default: 'ZA' })
  @IsString()
  taxResidency: string;

  @ApiProperty({ type: SupplierPortalNominateEngagementDto })
  @ValidateNested()
  @Type(() => SupplierPortalNominateEngagementDto)
  engagement: SupplierPortalNominateEngagementDto;

  @ApiPropertyOptional({ description: 'Optional note for nomination intake' })
  @IsOptional()
  @IsString()
  nominationReason?: string;
}
