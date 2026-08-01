import { ZA_PAYE_2025_2026_DEFAULT } from '../templates';

describe('ZA_PAYE_2025_2026_DEFAULT', () => {
  it('has correct identity metadata', () => {
    expect(ZA_PAYE_2025_2026_DEFAULT.countryCode).toBe('ZA');
    expect(ZA_PAYE_2025_2026_DEFAULT.tableType).toBe('PAYE');
    expect(ZA_PAYE_2025_2026_DEFAULT.taxYear).toBe('2025/2026');
    expect(ZA_PAYE_2025_2026_DEFAULT.status).toBe('ACTIVE');
  });

  it('has exactly one open-ended bracket', () => {
    const openEnded = ZA_PAYE_2025_2026_DEFAULT.brackets.filter((b) => b.isOpenEnded);
    expect(openEnded).toHaveLength(1);
    expect(openEnded[0].bracketTo).toBeNull();
  });

  it('has continuous brackets', () => {
    const brackets = ZA_PAYE_2025_2026_DEFAULT.brackets;
    for (let i = 0; i < brackets.length - 1; i++) {
      expect(brackets[i].bracketTo).toBe(brackets[i + 1].bracketFrom);
    }
  });

  it('starts from zero', () => {
    expect(ZA_PAYE_2025_2026_DEFAULT.brackets[0].bracketFrom).toBe(0);
  });

  it('has 7 brackets', () => {
    expect(ZA_PAYE_2025_2026_DEFAULT.brackets).toHaveLength(7);
  });

  it('has valid marginal rates (0 < rate <= 1)', () => {
    for (const b of ZA_PAYE_2025_2026_DEFAULT.brackets) {
      expect(b.marginalRate).toBeGreaterThan(0);
      expect(b.marginalRate).toBeLessThanOrEqual(1);
    }
  });

  it('has ascending marginal rates', () => {
    const rates = ZA_PAYE_2025_2026_DEFAULT.brackets.map((b) => b.marginalRate);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    }
  });

  it('includes all required rebate and threshold fields', () => {
    const requiredCodes = [
      'primary_rebate',
      'secondary_rebate',
      'tertiary_rebate',
      'tax_threshold_under_65',
      'tax_threshold_65_to_74',
      'tax_threshold_75_plus',
    ];

    for (const code of requiredCodes) {
      const field = ZA_PAYE_2025_2026_DEFAULT.supplementalFields.find((f) => f.fieldCode === code);
      expect(field).toBeDefined();
      expect(field?.required).toBe(true);
      expect(typeof field?.fieldValue).toBe('number');
    }
  });

  it('has age-aware simulation defaults', () => {
    expect(ZA_PAYE_2025_2026_DEFAULT.simulationDefaults?.ages?.length).toBeGreaterThanOrEqual(2);
    expect(ZA_PAYE_2025_2026_DEFAULT.simulationDefaults?.incomes.length).toBeGreaterThanOrEqual(2);
  });

  it('has compatibility metadata', () => {
    expect(ZA_PAYE_2025_2026_DEFAULT.compatibility?.packCodes).toContain('za-pack');
  });
});
