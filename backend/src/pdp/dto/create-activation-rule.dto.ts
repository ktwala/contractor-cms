import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PdpAction, PdpDecisionType } from '../pdp.types';
import { PdpReasonCode } from '../pdp.reason-codes';

// Because we don't have PdpDecisionType as a true enum in types.ts (it's a string union type),
// we can define an array for validation, or just use string validation if we don't want to over-engineer it.
const VALID_ENFORCEMENT_LEVELS = ['SHADOW', 'WARN', 'APPROVAL_REQUIRED', 'SOFT_BLOCK', 'HARD_BLOCK'];
const VALID_ACTIONS = ['SUBMIT_TIMESHEET', 'SUBMIT_INVOICE'];

export class CreateActivationRuleDto {
  @IsOptional()
  @IsEnum(PdpReasonCode)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  // @IsEnum doesn't work out of the box for string literal types without an actual Enum object, so using custom or simple string.
  action?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsString()
  enforcementLevel: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string; // ISO date string

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  approvedBy?: string;
}
