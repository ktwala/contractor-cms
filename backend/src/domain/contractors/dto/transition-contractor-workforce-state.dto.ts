import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractorWorkforceState } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/** PR-WORKFORCE-TRANSITIONS-1 — internal workforce plane transition (supplier-backed). */
export class TransitionContractorWorkforceStateDto {
  @ApiProperty({ enum: ContractorWorkforceState, enumName: 'ContractorWorkforceState' })
  @IsEnum(ContractorWorkforceState)
  targetState: ContractorWorkforceState;

  @ApiPropertyOptional({ description: 'Operator reason stored in workforce history' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description:
      'PR-WORKFORCE-BLACKLIST-1 — internal ops authority note (required when targetState is BLACKLISTED; not shown on supplier portal)',
  })
  @ValidateIf((dto) => dto.targetState === ContractorWorkforceState.BLACKLISTED)
  @IsString()
  @MaxLength(500)
  authorityNote?: string;
}
