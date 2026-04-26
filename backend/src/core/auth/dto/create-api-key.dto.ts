import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsDateString } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'HCM Integration',
    description: 'API key name/description',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: ['suppliers:read', 'invoices:write'],
    description: 'Array of permission scopes',
    type: [String],
  })
  @IsArray()
  scopes: string[];

  @ApiProperty({
    example: 'org-123',
    description: 'Organization ID (optional, for org-scoped keys)',
    required: false,
  })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({
    example: '2026-12-31T23:59:59Z',
    description: 'Expiration date (optional)',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
