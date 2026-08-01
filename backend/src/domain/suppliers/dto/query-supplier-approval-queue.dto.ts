import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class QuerySupplierApprovalQueueDto {
  @ApiPropertyOptional({
    description:
      'When true, only suppliers with incomplete CMS onboarding evidence (Oracle-trusted tenants may still show all pending governance)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  evidenceIncomplete?: boolean;
}
