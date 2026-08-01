import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSupplierDocumentDto {
  @ApiProperty({ description: 'Catalog evidence type code' })
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiPropertyOptional({ description: 'Storage path; generated if omitted' })
  @IsOptional()
  @IsString()
  filePath?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  fileSize: number;

  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
