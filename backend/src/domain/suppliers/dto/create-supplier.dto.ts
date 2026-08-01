import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { SupplierType } from '@prisma/client';

export class CreateSupplierDto {
  @ApiPropertyOptional({ description: 'Target organization (required for org-scoped create)' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiProperty({ enum: SupplierType })
  @IsEnum(SupplierType)
  type: SupplierType;

  // Company details (required if type = COMPANY)
  @ApiPropertyOptional()
  @ValidateIf((o) => o.type === SupplierType.COMPANY)
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vatNumber?: string;

  // Individual details (required if type = INDIVIDUAL)
  @ApiPropertyOptional()
  @ValidateIf((o) => o.type === SupplierType.INDIVIDUAL)
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.type === SupplierType.INDIVIDUAL)
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idNumber?: string;

  // Common fields
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradingName?: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  // Address
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 jurisdiction / address country' })
  @IsString()
  country: string;

  @ApiPropertyOptional({
    description:
      'Governance jurisdiction (ISO 3166-1 alpha-2). Defaults from country. Supported: ZA, LS.',
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  // Banking
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankBranchCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountType?: string;

  // Tax
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  taxClearanceExpiry?: string;

  @ApiPropertyOptional({ description: 'South Africa BBBEE Level' })
  @IsOptional()
  @IsString()
  bbbeeLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  bbbeeExpiry?: string;
}
