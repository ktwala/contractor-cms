import {
  formatAmountForCsvExport,
  formatContractTypeLabel,
  formatCurrencyDisplay,
  formatEngagementTitleDisplay,
} from '@/lib/display-format';

describe('display-format', () => {
  describe('formatContractTypeLabel', () => {
    it('returns Not classified for empty or unknown type', () => {
      expect(formatContractTypeLabel(null)).toBe('Not classified');
      expect(formatContractTypeLabel('')).toBe('Not classified');
      expect(formatContractTypeLabel('unknown')).toBe('Not classified');
    });

    it('formats enum-style types', () => {
      expect(formatContractTypeLabel('FIXED_TERM')).toBe('FIXED TERM');
    });
  });

  describe('formatCurrencyDisplay', () => {
    it('returns em dash for missing or invalid amounts', () => {
      expect(formatCurrencyDisplay(null, 'ZAR')).toBe('—');
      expect(formatCurrencyDisplay(undefined, 'ZAR')).toBe('—');
      expect(formatCurrencyDisplay(NaN, 'ZAR')).toBe('—');
    });

    it('formats valid amounts', () => {
      expect(formatCurrencyDisplay(100, 'ZAR')).toMatch(/100/);
    });
  });

  describe('formatAmountForCsvExport', () => {
    it('returns empty string for missing or invalid amounts', () => {
      expect(formatAmountForCsvExport(null)).toBe('');
      expect(formatAmountForCsvExport(NaN)).toBe('');
    });

    it('formats valid amounts as plain decimals', () => {
      expect(formatAmountForCsvExport(100)).toBe('100.00');
    });
  });

  describe('formatEngagementTitleDisplay', () => {
    it('returns Untitled engagement when title is missing', () => {
      expect(formatEngagementTitleDisplay(null)).toBe('Untitled engagement');
      expect(formatEngagementTitleDisplay('   ')).toBe('Untitled engagement');
    });

    it('preserves real titles', () => {
      expect(formatEngagementTitleDisplay('Q1 rollout')).toBe('Q1 rollout');
    });
  });
});
