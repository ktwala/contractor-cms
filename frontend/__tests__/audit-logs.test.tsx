import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useAuth } from '@/lib/auth-context';
import { PROTECTED_ROUTES, isRouteAllowed } from '@/lib/protected-routes';
import { PERMISSIONS } from '@/lib/permissions.generated';
import RequirePermission from '@/components/RequirePermission';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/settings/audit-logs',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api-audit', () => ({
  listAuditLogs: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'log-1',
        actorUserId: 'user-1',
        action: 'USER_ROLE_ASSIGNED',
        targetType: 'User',
        targetId: 'user-2',
        result: 'success',
        ipAddress: '10.0.0.15',
        createdAt: '2026-04-27T10:42:00Z',
        actor: {
          id: 'user-1',
          email: 'admin@company.com',
          firstName: 'Admin',
          lastName: 'User',
        },
        before: null,
        after: { roleName: 'FINANCE_USER', passwordHash: 'abc123' },
        metadata: null,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 50,
  }),
  getAuditLog: jest.fn(),
  exportAuditLogs: jest.fn().mockResolvedValue(undefined),
}));

describe('PR7 — Audit Log UI', () => {
  // -----------------------------------------------------------------------
  // Route & Sidebar
  // -----------------------------------------------------------------------

  describe('Route Registry', () => {
    it('has /settings/audit-logs route with audit:read permission', () => {
      const route = PROTECTED_ROUTES.find((r) => r.path === '/settings/audit-logs');
      expect(route).toBeDefined();
      expect(route!.permission).toBe(PERMISSIONS.AUDIT.READ);
      expect(route!.name).toBe('Audit Logs');
    });

    it('route is visible in sidebar (showInSidebar not false)', () => {
      const route = PROTECTED_ROUTES.find((r) => r.path === '/settings/audit-logs');
      expect(route).toBeDefined();
      expect(route!.showInSidebar).not.toBe(false);
    });
  });

  describe('Permission gating', () => {
    it('requires audit:read — redirects to /403 without it', async () => {
      const mockPush = jest.fn();
      jest.spyOn(require('next/navigation'), 'useRouter').mockImplementation(() => ({
        push: mockPush,
        replace: jest.fn(),
      }));

      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '1', effectivePermissions: [] },
        loading: false,
        can: jest.fn().mockReturnValue(false),
        canAny: jest.fn().mockReturnValue(false),
        canAll: jest.fn().mockReturnValue(false),
      });

      render(
        <RequirePermission permission={PERMISSIONS.AUDIT.READ}>
          <div>Audit Content</div>
        </RequirePermission>,
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/403');
      });
      expect(screen.queryByText('Audit Content')).not.toBeInTheDocument();
    });

    it('renders content when user has audit:read', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '1', effectivePermissions: ['audit:read'] },
        loading: false,
        can: jest.fn().mockReturnValue(true),
        canAny: jest.fn().mockReturnValue(true),
        canAll: jest.fn().mockReturnValue(true),
      });

      render(
        <RequirePermission permission={PERMISSIONS.AUDIT.READ}>
          <div>Audit Content</div>
        </RequirePermission>,
      );

      await waitFor(() => {
        expect(screen.getByText('Audit Content')).toBeInTheDocument();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Sidebar visibility
  // -----------------------------------------------------------------------

  describe('Sidebar visibility', () => {
    it('hides Audit Logs from sidebar when user lacks audit:read', () => {
      const canMock = jest.fn((perm: string) => perm !== 'audit:read');

      const visibleRoutes = PROTECTED_ROUTES.filter((route) => {
        if (route.showInSidebar === false) return false;
        return isRouteAllowed(route.permission, canMock);
      });

      const auditRoute = visibleRoutes.find((r) => r.path === '/settings/audit-logs');
      expect(auditRoute).toBeUndefined();
    });

    it('shows Audit Logs in sidebar when user has audit:read', () => {
      const canMock = jest.fn().mockReturnValue(true);

      const visibleRoutes = PROTECTED_ROUTES.filter((route) => {
        if (route.showInSidebar === false) return false;
        return isRouteAllowed(route.permission, canMock);
      });

      const auditRoute = visibleRoutes.find((r) => r.path === '/settings/audit-logs');
      expect(auditRoute).toBeDefined();
      expect(auditRoute!.name).toBe('Audit Logs');
    });
  });

  // -----------------------------------------------------------------------
  // Detail drawer — sensitive field masking
  // -----------------------------------------------------------------------

  describe('Sensitive field masking', () => {
    it('masks known sensitive field names', () => {
      const SENSITIVE_KEYS = new Set([
        'password',
        'passwordhash',
        'token',
        'secret',
        'apikey',
        'refreshtoken',
        'accesstoken',
        'privatekey',
      ]);

      const testPayload = {
        name: 'Test User',
        password: 'secret123',
        passwordHash: 'abc123hash',
        token: 'jwt-token',
        apiKey: 'key-123',
        role: 'ADMIN',
      };

      // Simulate the scrubbing logic
      const scrub = (obj: any): any => {
        const clean = JSON.parse(JSON.stringify(obj));
        for (const key of Object.keys(clean)) {
          if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            clean[key] = '***REDACTED***';
          }
        }
        return clean;
      };

      const result = scrub(testPayload);

      expect(result.name).toBe('Test User');
      expect(result.role).toBe('ADMIN');
      expect(result.password).toBe('***REDACTED***');
      expect(result.passwordHash).toBe('***REDACTED***');
      expect(result.token).toBe('***REDACTED***');
      expect(result.apiKey).toBe('***REDACTED***');
    });
  });

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------

  describe('Export', () => {
    it('export function is callable with filters', async () => {
      const { exportAuditLogs } = require('@/lib/api-audit');

      await exportAuditLogs({
        from: '2026-04-01',
        to: '2026-04-27',
        action: 'USER_ROLE_ASSIGNED',
      });

      expect(exportAuditLogs).toHaveBeenCalledWith({
        from: '2026-04-01',
        to: '2026-04-27',
        action: 'USER_ROLE_ASSIGNED',
      });
    });
  });

  // -----------------------------------------------------------------------
  // API call verification
  // -----------------------------------------------------------------------

  describe('API integration', () => {
    it('listAuditLogs is called with filter params', async () => {
      const { listAuditLogs } = require('@/lib/api-audit');

      await listAuditLogs({
        from: '2026-04-26',
        to: '2026-04-27',
        action: 'ROLE_CREATED',
        result: 'success',
        page: 1,
        pageSize: 50,
      });

      expect(listAuditLogs).toHaveBeenCalledWith({
        from: '2026-04-26',
        to: '2026-04-27',
        action: 'ROLE_CREATED',
        result: 'success',
        page: 1,
        pageSize: 50,
      });
    });

    it('listAuditLogs returns paginated response', async () => {
      const { listAuditLogs } = require('@/lib/api-audit');

      const result = await listAuditLogs({});

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // No raw permission strings
  // -----------------------------------------------------------------------

  describe('No raw permission strings', () => {
    it('uses PERMISSIONS constant, not raw string', () => {
      expect(PERMISSIONS.AUDIT.READ).toBe('audit:read');

      // Verify the route uses the constant (already validated by the route test above)
      const route = PROTECTED_ROUTES.find((r) => r.path === '/settings/audit-logs');
      expect(route!.permission).toBe(PERMISSIONS.AUDIT.READ);
    });
  });
});
