import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractorWorkforceState } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class QueryContractorWorkforceReviewDto {
  @ApiPropertyOptional({
    enum: ContractorWorkforceState,
    enumName: 'ContractorWorkforceState',
    description: 'Optional filter — defaults to NOMINATED and PENDING_APPROVAL',
  })
  @IsOptional()
  @IsEnum(ContractorWorkforceState)
  workforceState?: ContractorWorkforceState;
}
