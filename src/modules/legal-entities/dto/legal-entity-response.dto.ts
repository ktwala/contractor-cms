import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Country } from '../../../common/dto/enums.dto';

export class LegalEntityResponseDto {
  @ApiProperty({ example: 'le_za_001' })
  id: string;

  @ApiProperty({ example: 'HUBSEC-ZA' })
  code: string;

  @ApiProperty({ example: 'Hubsec (Pty) Ltd' })
  name: string;

  @ApiProperty({ enum: Country, example: Country.ZA })
  country: Country;

  @ApiPropertyOptional({ example: '2020/123456/07' })
  registration_no?: string;

  @ApiPropertyOptional({ example: '9012345678' })
  tax_reference?: string;

  @ApiPropertyOptional()
  address?: Record<string, any>;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}

export class PaginatedLegalEntitiesDto {
  @ApiProperty({ type: [LegalEntityResponseDto] })
  items: LegalEntityResponseDto[];

  @ApiProperty({ example: 0 })
  offset: number;

  @ApiProperty({ example: 50 })
  limit: number;

  @ApiProperty({ example: 5 })
  total: number;
}
