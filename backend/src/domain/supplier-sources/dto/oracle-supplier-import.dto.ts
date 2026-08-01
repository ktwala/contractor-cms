import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class OracleSupplierRecordDto {
  @ApiProperty({ description: 'Oracle supplier id (upstream master key)' })
  @IsString()
  externalSupplierId: string;

  @ApiPropertyOptional({ description: 'Oracle supplier number' })
  @IsOptional()
  @IsString()
  supplierNumber?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 jurisdiction / country' })
  @IsString()
  countryCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxRegistrationNumber?: string;

  @ApiPropertyOptional({
    description: 'Additional Oracle fields preserved in rawPayload',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class OracleSupplierImportDto {
  @ApiProperty({ type: [OracleSupplierRecordDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OracleSupplierRecordDto)
  suppliers: OracleSupplierRecordDto[];
}
