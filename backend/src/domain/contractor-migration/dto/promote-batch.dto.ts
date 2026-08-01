import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class PromoteBatchDto {
  @ApiPropertyOptional({
    description: 'Enqueue contractor.migrated IGA outbox event on success',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  publishToIga?: boolean;

  @ApiPropertyOptional({
    description: 'Preflight promote without writing operational workforce rows',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
