import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class PromoteOracleStagingDto {
  @ApiPropertyOptional({
    description:
      'Specific staging row ids to promote. When omitted, all MATCHED/NEW rows are promoted.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  stagingIds?: string[];
}
