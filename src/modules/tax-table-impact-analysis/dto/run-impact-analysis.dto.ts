import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum ImpactAnalysisBasisMode {
  LAST_CLOSED_PAYRUN = 'LAST_CLOSED_PAYRUN',
  PAYRUN_ID = 'PAYRUN_ID',
}

export class RunImpactAnalysisDto {
  @ApiProperty()
  @IsUUID()
  authoringVersionId!: string;

  @ApiProperty({ enum: ImpactAnalysisBasisMode })
  @IsEnum(ImpactAnalysisBasisMode)
  basisMode!: ImpactAnalysisBasisMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  payGroupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  payrunId?: string;

  @ApiProperty()
  @IsString()
  countryCode!: 'ZA' | 'LS';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  legalEntityId?: string;

  @ApiPropertyOptional({ default: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  affectedOnly?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAbsoluteDelta?: number;
}
