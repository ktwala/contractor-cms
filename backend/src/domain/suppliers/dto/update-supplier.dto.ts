import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SupplierSourceSystem } from '@prisma/client';
import { CreateSupplierDto } from './create-supplier.dto';

/** Profile fields only — use PATCH /suppliers/:id/status for lifecycle transitions. */
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  /** Rejected when supplier is Oracle-linked (PR-CMS-DATA-2). */
  @ApiPropertyOptional({ enum: SupplierSourceSystem })
  @IsOptional()
  @IsEnum(SupplierSourceSystem)
  sourceSystem?: SupplierSourceSystem;

  /** Rejected when supplier is Oracle-linked (PR-CMS-DATA-2). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalSupplierId?: string;
}
