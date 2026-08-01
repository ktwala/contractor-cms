/**
 * Shared page-state classification for consistent error/empty/blocked handling.
 *
 * Every data page should classify its state into one of:
 *   loading  – skeleton / spinner
 *   error    – true failure (network, 500, malformed response)
 *   blocked  – known business-rule / readiness issue (structured code from backend)
 *   empty    – request succeeded but no data exists yet
 *   ready    – data loaded and available
 *
 * See /docs/PAGE_STATE_CONTRACT.md for full contributor guidance.
 */

// ─── Types ───────────────────────────────────────────────────────

export type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; code?: string; status?: number; retryable: boolean }
  | { kind: 'blocked'; code: string; message: string; icon?: 'setup' | 'lock' | 'unavailable'; ctaLabel?: string; ctaHref?: string }
  | { kind: 'empty'; message?: string; actionLabel?: string; actionHref?: string }
  | { kind: 'ready' };

export interface BlockedCodeInfo {
  message: string;
  icon?: 'setup' | 'lock' | 'unavailable';
  cta?: { label: string; path: string };
  helpText?: string;
}

export interface ExtractedError {
  code: string;
  message: string;
  status: number;
}

// ─── Blocked-code registry ───────────────────────────────────────
// Single source of truth. Add one entry here and every page that uses
// classifyPageState/classifyError gains the correct UX automatically.

const BLOCKED_CODES: Record<string, BlockedCodeInfo> = {
  // Payroll readiness
  PAYROLL_LEGAL_ENTITY_REQUIRED: {
    icon: 'setup',
    message: 'Create a legal entity and assign it to your user account to get started.',
    cta: { label: 'Go to Legal Entities', path: '/admin/legal-entities' },
    helpText: 'A legal entity represents the employing company. Payruns, tax tables, and compliance reports are all scoped to a legal entity. Until one is created and assigned to your user, payroll features cannot load data.',
  },
  PAYROLL_NO_PAY_GROUPS: {
    icon: 'setup',
    message: 'Set up at least one pay group before managing payruns.',
    cta: { label: 'Go to Pay Groups', path: '/admin/pay-groups' },
    helpText: 'A pay group defines the payroll cycle, frequency, and country rules for a set of employees. At least one pay group must exist under a legal entity before payruns can be created.',
  },
  PAYROLL_NO_EMPLOYEES: {
    icon: 'setup',
    message: 'Import or add employees before running payroll.',
    cta: { label: 'Go to Employees', path: '/admin/employees' },
    helpText: 'Employees must be imported or created and assigned to a pay group before payroll calculations can run. Use the data import wizard or add employees individually.',
  },
  PAYROLL_LEGAL_ENTITY_DENIED: {
    icon: 'lock',
    message: 'You do not have access to the requested legal entity. Contact your administrator.',
    helpText: 'Your user account has role assignments scoped to specific legal entities. The entity required by this page is not in your access list. An administrator can update your role assignments.',
  },

  // Generic RBAC / permission denial (backend returns code "FORBIDDEN" for bare ForbiddenExceptions)
  FORBIDDEN: {
    icon: 'lock',
    message: 'You do not have permission to access this feature. Contact your administrator.',
    helpText: 'This action requires a specific permission that is not included in your current role. Contact your administrator to request the necessary role or permission assignment.',
  },

  // Feature not deployed / not available for this tenant
  FEATURE_NOT_AVAILABLE: {
    icon: 'unavailable',
    message: 'This feature is not available for your organisation.',
  },
};

export function isBlockedCode(code: string): boolean {
  return code in BLOCKED_CODES;
}

export function getBlockedInfo(code: string): BlockedCodeInfo | null {
  return BLOCKED_CODES[code] ?? null;
}

// ─── Error extraction ────────────────────────────────────────────

/**
 * Extract a structured error code from an Axios error response.
 * The backend global exception filter returns { code, message, ... }.
 */
export function extractErrorInfo(err: any): ExtractedError {
  const status = err?.response?.status ?? 0;
  const data = err?.response?.data;
  const code = data?.code ?? data?.error?.code ?? '';
  const message = data?.message ?? data?.error?.message ?? err?.message ?? 'An unexpected error occurred';
  return { code, message, status };
}

// ─── Classification ──────────────────────────────────────────────

/**
 * Classify an API error into either a 'blocked' state (known readiness issue)
 * or an 'error' state (true failure).
 */
export function classifyError(err: any): PageState {
  const { code, message, status } = extractErrorInfo(err);

  if (code && isBlockedCode(code)) {
    const info = getBlockedInfo(code);
    return {
      kind: 'blocked',
      code,
      message,
      icon: info?.icon,
      ctaLabel: info?.cta?.label,
      ctaHref: info?.cta?.path,
    };
  }

  // Network-level failures (no response at all)
  if (!err?.response) {
    return { kind: 'error', message: 'Unable to connect to the server. Check your network.', code: 'NETWORK_ERROR', status: 0, retryable: true };
  }

  // 501 Not Implemented → feature not available (common for tenant-gated modules)
  if (status === 501) {
    const info = getBlockedInfo('FEATURE_NOT_AVAILABLE');
    return {
      kind: 'blocked',
      code: 'FEATURE_NOT_AVAILABLE',
      message,
      icon: info?.icon,
      ctaLabel: info?.cta?.label,
      ctaHref: info?.cta?.path,
    };
  }

  // Server errors are retryable; client errors generally are not
  const retryable = status >= 500 || status === 0;
  return { kind: 'error', message, code: code || undefined, status: status || undefined, retryable };
}

/**
 * Determine the full page state given loading, error, and data.
 */
export function classifyPageState<T>(opts: {
  loading: boolean;
  error: any | null;
  data: T[] | null | undefined;
}): PageState {
  if (opts.loading) return { kind: 'loading' };
  if (opts.error) return classifyError(opts.error);
  if (!opts.data || opts.data.length === 0) return { kind: 'empty' };
  return { kind: 'ready' };
}
