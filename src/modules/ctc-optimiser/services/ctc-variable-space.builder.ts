import { Injectable } from '@nestjs/common';
import { RunSimpleCtcOptimiserDto } from '../dto/run-simple-ctc-optimiser.dto';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';

export interface VariableSpace {
  ctc: number;
  fixedMedical: number;
  basicRange: { min: number; max: number };
  travelRange: { min: number; max: number };
  retirementRange: { min: number; max: number };
  reimbursiveRange: { min: number; max: number };
}

/**
 * Derives the solver's variable space from a simplified user input.
 * Separates fixed anchors (medical, CTC) from adjustable levers
 * (basic, travel, retirement, reimbursive) and computes legal bounds.
 */
@Injectable()
export class CtcVariableSpaceBuilder {
  build(dto: RunSimpleCtcOptimiserDto): VariableSpace {
    const ctc = dto.packageInput.ctc;
    const medical = dto.packageInput.medicalAidAmount;
    const adv = dto.advancedConstraints;

    const minBasicPct = (adv?.minBasicPercent ?? 55) / 100;
    const maxBasicPct = 0.85;

    const maxTravelPct = dto.policyInput.allowTravelAllowance
      ? (adv?.maxTravelPercent ?? 25) / 100
      : 0;

    const retirementMin = dto.policyInput.requireRetirementFund
      ? Math.max(dto.policyInput.minimumRetirementAmount ?? 0, ctc * 0.05)
      : 0;
    const retirementMax = Math.min(ctc * 0.20, ctc - medical);

    const reimbursiveMax = dto.policyInput.allowTravelAllowance
      ? (adv?.maxReimbursiveAmount ?? Math.min(ctc * 0.05, 5000))
      : 0;

    return {
      ctc,
      fixedMedical: medical,
      basicRange: {
        min: Math.round(ctc * minBasicPct),
        max: Math.round(ctc * maxBasicPct),
      },
      travelRange: {
        min: 0,
        max: Math.round(ctc * maxTravelPct),
      },
      retirementRange: {
        min: Math.round(retirementMin),
        max: Math.round(retirementMax),
      },
      reimbursiveRange: {
        min: 0,
        max: Math.round(reimbursiveMax),
      },
    };
  }

  /**
   * Convert a simple DTO into the existing RunCtcOptimiserDto shape
   * so downstream services (generator, constraint, evaluator) work unchanged.
   */
  toFullDto(dto: RunSimpleCtcOptimiserDto): RunCtcOptimiserDto {
    const adv = dto.advancedConstraints;
    const full = new RunCtcOptimiserDto();

    full.countryCode = dto.countryCode;
    full.taxYear = dto.taxYear;
    full.payFrequency = dto.payFrequency;
    full.legalEntityId = dto.legalEntityId;
    full.employeeId = dto.employeeId;
    full.ctc = dto.packageInput.ctc;
    full.optimisationMode = dto.optimisationMode;
    full.targetNet = dto.packageInput.targetNet;

    full.medicalAid = {
      amount: dto.packageInput.medicalAidAmount,
      beneficiaries: dto.packageInput.beneficiaries,
      fundingModel: dto.packageInput.medicalFundingModel ?? 'EMPLOYER_FUNDED',
    };

    full.retirement = {
      minAmount: dto.policyInput.minimumRetirementAmount ?? 0,
      targetAmount: dto.policyInput.minimumRetirementAmount
        ? Math.max(dto.policyInput.minimumRetirementAmount, dto.packageInput.ctc * 0.08)
        : dto.packageInput.ctc * 0.08,
    };

    full.travel = {
      enabled: dto.policyInput.allowTravelAllowance,
      maxPercent: adv?.maxTravelPercent ?? 25,
    };

    full.reimbursive = {
      enabled: dto.policyInput.allowTravelAllowance,
      maxAmount: adv?.maxReimbursiveAmount ?? Math.min(dto.packageInput.ctc * 0.05, 5000),
    };

    full.constraints = {
      minBasicPercent: adv?.minBasicPercent ?? 55,
      maxAllowancePercent: adv?.maxAllowancePercent ?? 35,
      requireMedicalAidAsEmployerContribution: adv?.requireMedicalAsEmployerContribution ?? true,
      requireRetirementFund: dto.policyInput.requireRetirementFund,
    };

    return full;
  }
}
