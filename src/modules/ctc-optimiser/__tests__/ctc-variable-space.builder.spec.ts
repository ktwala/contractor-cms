import { CtcVariableSpaceBuilder } from '../services/ctc-variable-space.builder';
import { RunSimpleCtcOptimiserDto } from '../dto/run-simple-ctc-optimiser.dto';

describe('CtcVariableSpaceBuilder', () => {
  let builder: CtcVariableSpaceBuilder;

  beforeEach(() => {
    builder = new CtcVariableSpaceBuilder();
  });

  function makeSimpleInput(overrides: Partial<RunSimpleCtcOptimiserDto> = {}): RunSimpleCtcOptimiserDto {
    return {
      countryCode: 'ZA',
      taxYear: '2025/2026',
      payFrequency: 'monthly',
      optimisationMode: 'TARGET_NET',
      packageInput: { ctc: 120000, targetNet: 80000, medicalAidAmount: 15000, beneficiaries: 2 },
      policyInput: { allowTravelAllowance: true, requireRetirementFund: true, minimumRetirementAmount: 5000 },
      advancedConstraints: { minBasicPercent: 55, maxAllowancePercent: 35 },
      ...overrides,
    } as RunSimpleCtcOptimiserDto;
  }

  describe('build()', () => {
    it('computes basic range from minBasicPercent to 85%', () => {
      const space = builder.build(makeSimpleInput());
      expect(space.basicRange.min).toBe(Math.round(120000 * 0.55));
      expect(space.basicRange.max).toBe(Math.round(120000 * 0.85));
    });

    it('sets travel range to zero when travel not allowed', () => {
      const dto = makeSimpleInput({
        policyInput: { allowTravelAllowance: false, requireRetirementFund: true, minimumRetirementAmount: 5000 },
      } as any);
      const space = builder.build(dto);
      expect(space.travelRange.max).toBe(0);
    });

    it('computes retirement minimum from policy input', () => {
      const dto = makeSimpleInput({
        policyInput: { allowTravelAllowance: true, requireRetirementFund: true, minimumRetirementAmount: 8000 },
      } as any);
      const space = builder.build(dto);
      expect(space.retirementRange.min).toBeGreaterThanOrEqual(8000);
    });

    it('sets retirement min to 0 when not required', () => {
      const dto = makeSimpleInput({
        policyInput: { allowTravelAllowance: true, requireRetirementFund: false },
      } as any);
      const space = builder.build(dto);
      expect(space.retirementRange.min).toBe(0);
    });

    it('sets reimbursive max to 0 when travel not allowed', () => {
      const dto = makeSimpleInput({
        policyInput: { allowTravelAllowance: false, requireRetirementFund: true, minimumRetirementAmount: 5000 },
      } as any);
      const space = builder.build(dto);
      expect(space.reimbursiveRange.max).toBe(0);
    });

    it('fixedMedical matches input', () => {
      const space = builder.build(makeSimpleInput());
      expect(space.fixedMedical).toBe(15000);
    });
  });

  describe('toFullDto()', () => {
    it('maps packageInput fields correctly', () => {
      const full = builder.toFullDto(makeSimpleInput());
      expect(full.ctc).toBe(120000);
      expect(full.targetNet).toBe(80000);
      expect(full.medicalAid.amount).toBe(15000);
      expect(full.medicalAid.beneficiaries).toBe(2);
    });

    it('maps travel enabled from policyInput', () => {
      const full = builder.toFullDto(makeSimpleInput());
      expect(full.travel.enabled).toBe(true);

      const noTravel = builder.toFullDto(makeSimpleInput({
        policyInput: { allowTravelAllowance: false, requireRetirementFund: true, minimumRetirementAmount: 5000 },
      } as any));
      expect(noTravel.travel.enabled).toBe(false);
    });

    it('maps requireRetirementFund from policyInput', () => {
      const full = builder.toFullDto(makeSimpleInput());
      expect(full.constraints.requireRetirementFund).toBe(true);
    });

    it('passes advanced constraints when provided', () => {
      const full = builder.toFullDto(makeSimpleInput({
        advancedConstraints: { minBasicPercent: 60, maxAllowancePercent: 30, maxTravelPercent: 20, maxReimbursiveAmount: 3000 },
      }));
      expect(full.constraints.minBasicPercent).toBe(60);
      expect(full.constraints.maxAllowancePercent).toBe(30);
      expect(full.travel.maxPercent).toBe(20);
      expect(full.reimbursive.maxAmount).toBe(3000);
    });

    it('uses sensible defaults when no advanced constraints', () => {
      const full = builder.toFullDto(makeSimpleInput({ advancedConstraints: undefined }));
      expect(full.constraints.minBasicPercent).toBe(55);
      expect(full.constraints.maxAllowancePercent).toBe(35);
    });

    it('preserves optimisationMode', () => {
      const full = builder.toFullDto(makeSimpleInput({ optimisationMode: 'MAX_NET' }));
      expect(full.optimisationMode).toBe('MAX_NET');
    });

    it('passes medicalFundingModel through to full DTO', () => {
      const dto = makeSimpleInput();
      dto.packageInput.medicalFundingModel = 'EMPLOYEE_PAID';
      const full = builder.toFullDto(dto);
      expect(full.medicalAid.fundingModel).toBe('EMPLOYEE_PAID');
    });

    it('defaults medicalFundingModel to EMPLOYER_FUNDED', () => {
      const full = builder.toFullDto(makeSimpleInput());
      expect(full.medicalAid.fundingModel).toBe('EMPLOYER_FUNDED');
    });
  });
});
