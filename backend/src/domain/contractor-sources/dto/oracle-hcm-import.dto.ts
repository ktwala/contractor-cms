import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class OracleHcmFileImportDto {
  @ApiProperty({ enum: ['json', 'csv'] })
  @IsIn(['json', 'csv'])
  format: 'json' | 'csv';

  @ApiProperty({ description: 'File content (JSON array or CSV)' })
  @IsString()
  content: string;
}

export class OracleHcmSyncResponseDto {
  @ApiProperty()
  syncRunId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  mode: string;

  @ApiProperty()
  summary: {
    imported: number;
    matched: number;
    possibleMatch: number;
    new: number;
    conflict: number;
    correlationFailures: number;
    failed: number;
  };

  @ApiProperty({ required: false })
  connectorHealth?: string;

  @ApiProperty({ required: false })
  checkpointTo?: string | null;
}
