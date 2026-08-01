import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ImpactExportFormat {
  CSV = 'CSV',
}

export class ExportImpactAnalysisDto {
  @ApiProperty({ enum: ImpactExportFormat })
  @IsEnum(ImpactExportFormat)
  format!: ImpactExportFormat;
}
