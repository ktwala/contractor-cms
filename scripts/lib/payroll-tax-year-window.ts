/**
 * Statutory tax-year windows for Payroll containers (PR-PAYROLL-CONTAINER-2).
 * ZA: March 1 → last day of February (aligned with common SARS practice in-platform).
 * LS: April 1 → March 31 (Lesotho fiscal/tax tables use April-year labeling).
 *
 * Period rows use `start_date` as the canonical anchor when assigning a container.
 */
import type { Country } from '@prisma/client';

export type TaxYearWindow = {
  taxYearStart: Date;
  taxYearEnd: Date;
  /** e.g. "2024/2025" — first calendar year of the window start month */
  label: string;
};

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Normalize to UTC midnight for stable date-only comparisons (@db.Date). */
export function toUtcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Returns the statutory shell window containing `anchor` for the given country.
 */
export function statutoryTaxYearWindowForDate(country: Country, anchor: Date): TaxYearWindow {
  const d = toUtcDateOnly(anchor);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();

  switch (country) {
    case 'ZA': {
      const startYear = m >= 2 ? y : y - 1;
      const taxYearStart = new Date(Date.UTC(startYear, 2, 1));
      const lastFebDay = isLeapYear(startYear + 1) ? 29 : 28;
      const taxYearEnd = new Date(Date.UTC(startYear + 1, 1, lastFebDay));
      return {
        taxYearStart,
        taxYearEnd,
        label: `${startYear}/${startYear + 1}`,
      };
    }
    case 'LS': {
      const startYear = m >= 3 ? y : y - 1;
      const taxYearStart = new Date(Date.UTC(startYear, 3, 1));
      const taxYearEnd = new Date(Date.UTC(startYear + 1, 2, 31));
      return {
        taxYearStart,
        taxYearEnd,
        label: `${startYear}/${startYear + 1}`,
      };
    }
    default: {
      const _exhaustive: never = country;
      throw new Error(`Unsupported country for tax-year window: ${_exhaustive}`);
    }
  }
}
