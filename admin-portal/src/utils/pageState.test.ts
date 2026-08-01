import { describe, it, expect } from 'vitest';
import {
  extractErrorInfo,
  classifyError,
  classifyPageState,
  isBlockedCode,
  getBlockedInfo,
} from './pageState';
import type { PageState } from './pageState';

// ─── Helpers ─────────────────────────────────────────────────────

function axiosError(status: number, data: Record<string, unknown> = {}) {
  return { response: { status, data } };
}

// ─── isBlockedCode ───────────────────────────────────────────────

describe('isBlockedCode', () => {
  it('returns true for registered payroll codes', () => {
    expect(isBlockedCode('PAYROLL_LEGAL_ENTITY_REQUIRED')).toBe(true);
    expect(isBlockedCode('PAYROLL_NO_PAY_GROUPS')).toBe(true);
    expect(isBlockedCode('PAYROLL_NO_EMPLOYEES')).toBe(true);
    expect(isBlockedCode('PAYROLL_LEGAL_ENTITY_DENIED')).toBe(true);
  });

  it('returns true for generic blocked codes', () => {
    expect(isBlockedCode('FORBIDDEN')).toBe(true);
    expect(isBlockedCode('FEATURE_NOT_AVAILABLE')).toBe(true);
  });

  it('returns false for unknown codes', () => {
    expect(isBlockedCode('RANDOM_CODE')).toBe(false);
    expect(isBlockedCode('')).toBe(false);
  });
});

// ─── getBlockedInfo ──────────────────────────────────────────────

describe('getBlockedInfo', () => {
  it('returns info with correct icon for setup codes', () => {
    const info = getBlockedInfo('PAYROLL_LEGAL_ENTITY_REQUIRED');
    expect(info).not.toBeNull();
    expect(info!.icon).toBe('setup');
    expect(info!.cta).toBeDefined();
    expect(info!.cta!.path).toBe('/admin/legal-entities');
  });

  it('returns info with lock icon for permission codes', () => {
    const info = getBlockedInfo('FORBIDDEN');
    expect(info).not.toBeNull();
    expect(info!.icon).toBe('lock');
    expect(info!.cta).toBeUndefined();
  });

  it('returns info with unavailable icon for feature codes', () => {
    const info = getBlockedInfo('FEATURE_NOT_AVAILABLE');
    expect(info).not.toBeNull();
    expect(info!.icon).toBe('unavailable');
  });

  it('returns null for unknown codes', () => {
    expect(getBlockedInfo('UNKNOWN')).toBeNull();
  });
});

// ─── extractErrorInfo ────────────────────────────────────────────

describe('extractErrorInfo', () => {
  it('extracts code and message from standard backend response', () => {
    const err = axiosError(403, {
      code: 'PAYROLL_LEGAL_ENTITY_REQUIRED',
      message: 'No legal entity access',
    });
    const info = extractErrorInfo(err);
    expect(info.code).toBe('PAYROLL_LEGAL_ENTITY_REQUIRED');
    expect(info.message).toBe('No legal entity access');
    expect(info.status).toBe(403);
  });

  it('extracts from nested error object', () => {
    const err = axiosError(403, {
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });
    const info = extractErrorInfo(err);
    expect(info.code).toBe('FORBIDDEN');
    expect(info.message).toBe('Access denied');
  });

  it('returns defaults for missing fields', () => {
    const info = extractErrorInfo({});
    expect(info.code).toBe('');
    expect(info.message).toBe('An unexpected error occurred');
    expect(info.status).toBe(0);
  });

  it('falls back to err.message when no response data', () => {
    const info = extractErrorInfo({ message: 'Network Error' });
    expect(info.message).toBe('Network Error');
  });
});

// ─── classifyError ───────────────────────────────────────────────

describe('classifyError', () => {
  it('classifies known blocked codes as blocked state', () => {
    const err = axiosError(403, {
      code: 'PAYROLL_LEGAL_ENTITY_REQUIRED',
      message: 'Missing legal entity',
    });
    const state = classifyError(err);
    expect(state.kind).toBe('blocked');
    if (state.kind === 'blocked') {
      expect(state.code).toBe('PAYROLL_LEGAL_ENTITY_REQUIRED');
      expect(state.icon).toBe('setup');
      expect(state.ctaLabel).toBe('Go to Legal Entities');
      expect(state.ctaHref).toBe('/admin/legal-entities');
    }
  });

  it('classifies FORBIDDEN as blocked with lock icon', () => {
    const err = axiosError(403, { code: 'FORBIDDEN', message: 'Forbidden' });
    const state = classifyError(err);
    expect(state.kind).toBe('blocked');
    if (state.kind === 'blocked') {
      expect(state.icon).toBe('lock');
    }
  });

  it('classifies 501 as blocked FEATURE_NOT_AVAILABLE', () => {
    const err = axiosError(501, { message: 'Not implemented' });
    const state = classifyError(err);
    expect(state.kind).toBe('blocked');
    if (state.kind === 'blocked') {
      expect(state.code).toBe('FEATURE_NOT_AVAILABLE');
      expect(state.icon).toBe('unavailable');
    }
  });

  it('classifies network errors as retryable error', () => {
    const err = { message: 'Network Error' };
    const state = classifyError(err);
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.retryable).toBe(true);
      expect(state.code).toBe('NETWORK_ERROR');
      expect(state.status).toBe(0);
    }
  });

  it('classifies 500 as retryable error', () => {
    const err = axiosError(500, { message: 'Internal Server Error' });
    const state = classifyError(err);
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.retryable).toBe(true);
      expect(state.status).toBe(500);
    }
  });

  it('classifies 502/503 as retryable error', () => {
    for (const status of [502, 503]) {
      const err = axiosError(status, { message: 'Gateway error' });
      const state = classifyError(err);
      expect(state.kind).toBe('error');
      if (state.kind === 'error') {
        expect(state.retryable).toBe(true);
      }
    }
  });

  it('classifies 400 as non-retryable error', () => {
    const err = axiosError(400, { message: 'Bad Request' });
    const state = classifyError(err);
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.retryable).toBe(false);
      expect(state.status).toBe(400);
    }
  });

  it('classifies 404 as non-retryable error', () => {
    const err = axiosError(404, { message: 'Not Found' });
    const state = classifyError(err);
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.retryable).toBe(false);
    }
  });

  it('classifies unknown code with 403 as blocked when registered', () => {
    const err = axiosError(403, {
      code: 'PAYROLL_LEGAL_ENTITY_DENIED',
      message: 'Denied',
    });
    const state = classifyError(err);
    expect(state.kind).toBe('blocked');
    if (state.kind === 'blocked') {
      expect(state.icon).toBe('lock');
    }
  });

  it('classifies unregistered code with 403 as non-retryable error', () => {
    const err = axiosError(403, {
      code: 'SOME_UNKNOWN_CODE',
      message: 'Something else',
    });
    const state = classifyError(err);
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.retryable).toBe(false);
    }
  });
});

// ─── classifyPageState ───────────────────────────────────────────

describe('classifyPageState', () => {
  it('returns loading when loading is true', () => {
    const state = classifyPageState({ loading: true, error: null, data: null });
    expect(state.kind).toBe('loading');
  });

  it('loading takes precedence over error', () => {
    const state = classifyPageState({
      loading: true,
      error: axiosError(500, { message: 'fail' }),
      data: null,
    });
    expect(state.kind).toBe('loading');
  });

  it('returns error for API failures', () => {
    const state = classifyPageState({
      loading: false,
      error: axiosError(500, { message: 'fail' }),
      data: null,
    });
    expect(state.kind).toBe('error');
  });

  it('returns blocked for known error codes', () => {
    const state = classifyPageState({
      loading: false,
      error: axiosError(403, {
        code: 'PAYROLL_LEGAL_ENTITY_REQUIRED',
        message: 'Missing legal entity',
      }),
      data: null,
    });
    expect(state.kind).toBe('blocked');
  });

  it('returns empty for null data', () => {
    const state = classifyPageState({ loading: false, error: null, data: null });
    expect(state.kind).toBe('empty');
  });

  it('returns empty for undefined data', () => {
    const state = classifyPageState({ loading: false, error: null, data: undefined });
    expect(state.kind).toBe('empty');
  });

  it('returns empty for empty array', () => {
    const state = classifyPageState({ loading: false, error: null, data: [] });
    expect(state.kind).toBe('empty');
  });

  it('returns ready for non-empty data', () => {
    const state = classifyPageState({
      loading: false,
      error: null,
      data: [{ id: 1 }],
    });
    expect(state.kind).toBe('ready');
  });

  it('error takes precedence over data', () => {
    const state = classifyPageState({
      loading: false,
      error: axiosError(500, { message: 'fail' }),
      data: [{ id: 1 }],
    });
    expect(state.kind).toBe('error');
  });
});

// ─── Icon/title mapping coverage ─────────────────────────────────

describe('blocked code icon mapping', () => {
  const codeIconMap: [string, 'setup' | 'lock' | 'unavailable'][] = [
    ['PAYROLL_LEGAL_ENTITY_REQUIRED', 'setup'],
    ['PAYROLL_NO_PAY_GROUPS', 'setup'],
    ['PAYROLL_NO_EMPLOYEES', 'setup'],
    ['PAYROLL_LEGAL_ENTITY_DENIED', 'lock'],
    ['FORBIDDEN', 'lock'],
    ['FEATURE_NOT_AVAILABLE', 'unavailable'],
  ];

  it.each(codeIconMap)('code %s maps to icon %s', (code, expectedIcon) => {
    const info = getBlockedInfo(code);
    expect(info).not.toBeNull();
    expect(info!.icon).toBe(expectedIcon);
  });
});
