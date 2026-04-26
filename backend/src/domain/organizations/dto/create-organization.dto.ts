import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Unique organization code' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ default: 'ZA', description: 'Country code (ISO 3166-1 alpha-2)' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ default: 'ZAR', description: 'Default currency code' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: 'Africa/Johannesburg', description: 'Timezone (IANA format)' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'HCM type: ORACLE_HCM, SAP_SF, WORKDAY, CUSTOM_NATS' })
  @IsOptional()
  @IsString()
  hcmType?: string;

  @ApiPropertyOptional({ description: 'HCM adapter configuration (JSON)' })
  @IsOptional()
  @IsObject()
  hcmConfig?: Record<string, any>;
}
