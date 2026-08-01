import { safeReplace, safeString } from './safe-string';

/** PR-CMS-FORMS-1 — user-facing labels for nullable API fields. */
export function formatContractTypeLabel(type: string | null | undefined): string {
  const raw = safeString(type).trim();
  if (!raw) return 'Not classified';
  const label = safeReplace(raw, '_', ' ').trim();
  if (!label || label.toLowerCase() === 'unknown') return 'Not classified';
  return label;
}

export function formatCurrencyDisplay(
  amount: number | string | null | undefined,
  currency?: string | null,
): string {
  let numeric: number;
  if (typeof amount === 'string') {
    numeric = parseFloat(amount);
  } else if (amount == null) {
    return '—';
  } else {
    numeric = amount;
  }

  if (Number.isNaN(numeric)) return '—';

  const code = safeString(currency).trim() || 'ZAR';
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: code,
    }).format(numeric);
  } catch {
    return '—';
  }
}

export function formatEngagementTitleDisplay(title: string | null | undefined): string {
  const trimmed = safeString(title).trim();
  return trimmed || 'Untitled engagement';
}

/** Plain numeric amount for CSV (no symbol); empty when missing/invalid. */
export function formatAmountForCsvExport(
  amount: number | string | null | undefined,
): string {
  let numeric: number;
  if (typeof amount === 'string') {
    numeric = parseFloat(amount);
  } else if (amount == null) {
    return '';
  } else {
    numeric = amount;
  }

  if (Number.isNaN(numeric)) return '';
  return numeric.toFixed(2);
}

/** True when Intl currency formatting would surface NaN (e.g. "RNaN"). */
export function currencyDisplayWouldShowNan(
  amount: number | string | null | undefined,
  currency?: string | null,
): boolean {
  const display = formatCurrencyDisplay(amount, currency);
  return display.includes('NaN');
}
