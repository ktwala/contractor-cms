import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject } from 'class-validator';
import { Country } from '../../../common/dto/enums.dto';

export class CreateLegalEntityDto {
  @ApiProperty({ example: 'HUBSEC-ZA' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Hubsec (Pty) Ltd' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: Country, example: Country.ZA })
  @IsEnum(Country)
  country: Country;

  @ApiPropertyOptional({ example: '2020/123456/07' })
  @IsOptional()
  @IsString()
  registration_no?: string;

  @ApiPropertyOptional({ example: '9012345678' })
  @IsOptional()
  @IsString()
  tax_reference?: string;

  @ApiPropertyOptional({
    example: {
      street: '123 Main Street',
      city: 'Johannesburg',
      province: 'Gauteng',
      postal_code: '2000',
      country: 'South Africa',
    },
  })
  @IsOptional()
  @IsObject()
  address?: Record<string, any>;
}
