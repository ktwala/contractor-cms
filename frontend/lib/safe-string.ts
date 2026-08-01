import { format } from 'date-fns';

/** PR-CMS-RUNTIME-HARDENING-1 — never call string methods on nullable API fields. */
export function safeString(value: string | null | undefined): string {
  return value ?? '';
}

export function safeLower(value: string | null | undefined): string {
  return safeString(value).toLowerCase();
}

export function safeReplace(
  value: string | null | undefined,
  search: string | RegExp,
  replacement: string,
): string {
  return safeString(value).replace(search, replacement);
}

export function safeFormatDate(
  value: string | null | undefined,
  pattern: string,
  fallback = '—',
): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  try {
    return format(date, pattern);
  } catch {
    return fallback;
  }
}

export function safeIsoDatePart(value: string | null | undefined): string {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value;
}
