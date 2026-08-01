import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BracketInputDto {
  @ApiProperty() @IsNumber() seqNo: number;
  @ApiProperty() @IsNumber() bracketFrom: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() bracketTo: number | null = null;
  @ApiProperty() @IsNumber() marginalRate: number;
  @ApiProperty() @IsNumber() baseTax: number;
  @ApiProperty() @IsBoolean() isOpenEnded: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() baseTaxOverrideReason?: string;
}

export class FieldInputDto {
  @ApiProperty() @IsString() fieldCode: string;
  @ApiProperty() fieldValue: unknown;
}

export class CreateFromTemplateDto {
  @ApiProperty() @IsString() templateId: string;
  @ApiProperty() @IsString() countryCode: string;
  @ApiProperty() @IsString() tableType: string;
  @ApiProperty() @IsString() taxYear: string;
  @ApiProperty() @IsDateString() effectiveFrom: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
}

export class CreateFromCopyDto {
  @ApiProperty() @IsString() sourceAuthoringId: string;
  @ApiProperty() @IsString() taxYear: string;
  @ApiProperty() @IsDateString() effectiveFrom: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
}

export class CreateManualDto {
  @ApiProperty() @IsString() countryCode: string;
  @ApiProperty() @IsString() tableType: string;
  @ApiProperty() @IsString() taxYear: string;
  @ApiProperty() @IsDateString() effectiveFrom: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiProperty({ type: [BracketInputDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => BracketInputDto)
  brackets: BracketInputDto[];
  @ApiPropertyOptional({ type: [FieldInputDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FieldInputDto)
  fields?: FieldInputDto[];
}

export class UpdateBracketsDto {
  @ApiProperty({ type: [BracketInputDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => BracketInputDto)
  brackets: BracketInputDto[];
}

export class UpdateFieldsDto {
  @ApiProperty({ type: [FieldInputDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => FieldInputDto)
  fields: FieldInputDto[];
}

export class SubmitApprovalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class ApproveDto {
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class PublishDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class SimulateDto {
  @ApiProperty({ type: [Number] })
  @IsArray() @IsNumber({}, { each: true })
  annualIncomes: number[];

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) periodsPerYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() age?: number;
}

export class ImportBracketsDto {
  @ApiProperty() @IsString() countryCode: string;
  @ApiProperty() @IsString() tableType: string;
  @ApiProperty() @IsString() taxYear: string;
  @ApiProperty() @IsDateString() effectiveFrom: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceReference?: string;
  @ApiProperty({ type: [BracketInputDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => BracketInputDto)
  brackets: BracketInputDto[];
  @ApiPropertyOptional({ type: [FieldInputDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FieldInputDto)
  fields?: FieldInputDto[];
}
