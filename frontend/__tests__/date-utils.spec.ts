import { getDaysUntilExpiry, getContractValidityState } from '../lib/date-utils';

describe('Date Utilities', () => {
  beforeAll(() => {
    // Mock system time to a fixed date for reliable testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('getDaysUntilExpiry', () => {
    it('returns null for missing dates', () => {
      expect(getDaysUntilExpiry(null)).toBeNull();
      expect(getDaysUntilExpiry(undefined)).toBeNull();
      expect(getDaysUntilExpiry('')).toBeNull();
      expect(getDaysUntilExpiry('invalid-date')).toBeNull();
    });

    it('returns negative days for past dates', () => {
      expect(getDaysUntilExpiry('2026-04-20T12:00:00Z')).toBe(-11);
    });

    it('returns exactly 0 for today', () => {
      expect(getDaysUntilExpiry('2026-05-01T12:00:00Z')).toBe(0);
    });

    it('returns positive days for future dates', () => {
      expect(getDaysUntilExpiry('2026-05-11T12:00:00Z')).toBe(10);
      expect(getDaysUntilExpiry('2026-06-30T12:00:00Z')).toBe(60);
    });
  });

  describe('getContractValidityState', () => {
    it('returns "Missing End Date" for null inputs', () => {
      expect(getContractValidityState(null)).toBe('Missing End Date');
    });

    it('returns "Expired" for dates in the past', () => {
      expect(getContractValidityState('2026-04-30T12:00:00Z')).toBe('Expired');
    });

    it('returns "Expiring Soon" for dates within threshold', () => {
      // exactly 0
      expect(getContractValidityState('2026-05-01T12:00:00Z')).toBe('Expiring Soon');
      // exactly 60
      expect(getContractValidityState('2026-06-30T12:00:00Z')).toBe('Expiring Soon');
    });

    it('returns "Active" for dates beyond the threshold', () => {
      expect(getContractValidityState('2026-07-01T12:00:00Z')).toBe('Active');
      expect(getContractValidityState('2027-01-01T12:00:00Z')).toBe('Active');
    });

    it('respects custom thresholds', () => {
      expect(getContractValidityState('2026-06-15T12:00:00Z', 30)).toBe('Active'); // 45 days away > 30 threshold
      expect(getContractValidityState('2026-06-15T12:00:00Z', 90)).toBe('Expiring Soon'); // 45 days away <= 90 threshold
    });
  });
});
