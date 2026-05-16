import { resolveApiScope, API_ENDPOINT_CONTRACTS } from '../lib/api-contract';

describe('API Contract Registry', () => {
  describe('resolveApiScope', () => {
    it('returns global for undefined or empty url', () => {
      expect(resolveApiScope()).toBe('global');
      expect(resolveApiScope('')).toBe('global');
    });

    it('correctly resolves org-scoped endpoints', () => {
      const orgScopedPaths = [
        '/timesheets',
        '/timesheets/123/submit',
        '/invoices',
        '/invoices?status=PENDING',
        '/suppliers',
        '/suppliers/456',
        '/contractors',
        '/contracts',
        '/projects',
        '/engagements',
      ];

      orgScopedPaths.forEach((path) => {
        expect(resolveApiScope(path)).toBe('org-scoped');
      });
    });

    it('correctly resolves global endpoints', () => {
      const globalPaths = [
        '/analytics/dashboard',
        '/analytics/financial',
        '/audit/insights',
        '/audit-logs',
        '/users',
        '/users/123/roles',
        '/roles',
        '/organizations',
        '/settings/profile',
      ];

      globalPaths.forEach((path) => {
        expect(resolveApiScope(path)).toBe('global');
      });
    });

    it('correctly resolves public endpoints', () => {
      expect(resolveApiScope('/auth/login')).toBe('public');
      expect(resolveApiScope('/auth/refresh')).toBe('public');
    });

    it('defaults to global for unknown endpoints', () => {
      expect(resolveApiScope('/unknown-path')).toBe('global');
      expect(resolveApiScope('/api/v1/something')).toBe('global');
    });

    it('handles paths with or without leading slash uniformly', () => {
      expect(resolveApiScope('timesheets')).toBe('org-scoped');
      expect(resolveApiScope('audit/insights')).toBe('global');
    });
  });
});
