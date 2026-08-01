import { LS_PAYE_2025_2026_DEFAULT } from '../templates';

describe('LS_PAYE_2025_2026_DEFAULT', () => {
  it('has correct identity metadata', () => {
    expect(LS_PAYE_2025_2026_DEFAULT.countryCode).toBe('LS');
    expect(LS_PAYE_2025_2026_DEFAULT.tableType).toBe('PAYE');
    expect(LS_PAYE_2025_2026_DEFAULT.taxYear).toBe('2025/2026');
    expect(LS_PAYE_2025_2026_DEFAULT.status).toBe('ACTIVE');
  });

  it('has exactly one open-ended bracket', () => {
    const openEnded = LS_PAYE_2025_2026_DEFAULT.brackets.filter((b) => b.isOpenEnded);
    expect(openEnded).toHaveLength(1);
    expect(openEnded[0].bracketTo).toBeNull();
  });

  it('has continuous brackets', () => {
    const brackets = LS_PAYE_2025_2026_DEFAULT.brackets;
    for (let i = 0; i < brackets.length - 1; i++) {
      expect(brackets[i].bracketTo).toBe(brackets[i + 1].bracketFrom);
    }
  });

  it('starts from zero', () => {
    expect(LS_PAYE_2025_2026_DEFAULT.brackets[0].bracketFrom).toBe(0);
  });

  it('has valid marginal rates (0 < rate <= 1)', () => {
    for (const b of LS_PAYE_2025_2026_DEFAULT.brackets) {
      expect(b.marginalRate).toBeGreaterThan(0);
      expect(b.marginalRate).toBeLessThanOrEqual(1);
    }
  });

  it('includes annual tax credit', () => {
    const field = LS_PAYE_2025_2026_DEFAULT.supplementalFields.find(
      (f) => f.fieldCode === 'annual_tax_credit',
    );
    expect(field).toBeDefined();
    expect(field?.required).toBe(true);
    expect(field?.fieldValue).toBe(11640);
  });

  it('has simulation defaults', () => {
    expect(LS_PAYE_2025_2026_DEFAULT.simulationDefaults?.incomes.length).toBeGreaterThanOrEqual(2);
  });

  it('has compatibility metadata', () => {
    expect(LS_PAYE_2025_2026_DEFAULT.compatibility?.packCodes).toContain('ls-pack');
  });
});
