import { PartialType } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierStatus } from '@prisma/client';

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @ApiPropertyOptional({ enum: SupplierStatus })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;
}
