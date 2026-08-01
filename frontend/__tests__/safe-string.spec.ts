import {
  safeFormatDate,
  safeLower,
  safeReplace,
} from '@/lib/safe-string';

describe('safe-string (PR-CMS-RUNTIME-HARDENING-1)', () => {
  it('safeLower handles null/undefined', () => {
    expect(safeLower(null)).toBe('');
    expect(safeLower('ABC').includes('a')).toBe(true);
  });

  it('safeReplace handles null type', () => {
    expect(safeReplace(null, '_', ' ')).toBe('');
    expect(safeReplace('FIXED_TERM', '_', ' ')).toBe('FIXED TERM');
  });

  it('safeFormatDate returns fallback for invalid dates', () => {
    expect(safeFormatDate(undefined, 'MMM yyyy')).toBe('—');
    expect(safeFormatDate('not-a-date', 'MMM yyyy')).toBe('—');
    expect(safeFormatDate('2026-01-15T00:00:00.000Z', 'yyyy')).toBe('2026');
  });
});
