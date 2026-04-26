import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/auth-context';
import RequirePermission from '@/components/RequirePermission';
import { PROTECTED_ROUTES } from '@/lib/protected-routes';
import { PERMISSIONS } from '@/lib/permissions.generated';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/',
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

describe('Frontend RBAC Verification', () => {
  describe('RequirePermission Component', () => {
    it('redirects unauthorized users to /403', async () => {
      // Mock unauthenticated but logged in state
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '1' },
        isAuthenticated: true,
        loading: false,
        can: jest.fn().mockReturnValue(false),
      });

      // Need to mock router inside test to check if push was called
      const mockPush = jest.fn();
      jest.spyOn(require('next/navigation'), 'useRouter').mockImplementation(() => ({
        push: mockPush,
      }));

      render(
        <RequirePermission permission={PERMISSIONS.SUPPLIERS.READ}>
          <div>Protected Content</div>
        </RequirePermission>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/403');
      });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('renders children when authorized', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '1' },
        isAuthenticated: true,
        loading: false,
        can: jest.fn().mockReturnValue(true),
      });

      render(
        <RequirePermission permission={PERMISSIONS.SUPPLIERS.READ}>
          <div>Protected Content</div>
        </RequirePermission>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });
  });

  describe('Route Registry', () => {
    it('ensures all protected routes use valid generated permissions', () => {
      PROTECTED_ROUTES.forEach((route) => {
        if (route.permission) {
          // Check that the permission string exists in the PERMISSIONS constant
          const flatPermissions = Object.values(PERMISSIONS).flatMap((group) =>
            Object.values(group)
          );
          expect(flatPermissions).toContain(route.permission);
        }
      });
    });
  });

  describe('Action Gating Verification (Mock Example)', () => {
    it('hides protected action buttons when missing permissions', () => {
      const MockPage = () => {
        const { can } = useAuth();
        return (
          <div>
            <h1>Page</h1>
            {can(PERMISSIONS.SUPPLIERS.CREATE) && <button>Add Supplier</button>}
          </div>
        );
      };

      (useAuth as jest.Mock).mockReturnValue({
        can: jest.fn().mockReturnValue(false), // No create permission
      });

      render(<MockPage />);

      expect(screen.queryByText('Add Supplier')).not.toBeInTheDocument();
    });

    it('shows protected action buttons when has permission', () => {
      const MockPage = () => {
        const { can } = useAuth();
        return (
          <div>
            <h1>Page</h1>
            {can(PERMISSIONS.SUPPLIERS.CREATE) && <button>Add Supplier</button>}
          </div>
        );
      };

      (useAuth as jest.Mock).mockReturnValue({
        can: jest.fn().mockReturnValue(true), // Has create permission
      });

      render(<MockPage />);

      expect(screen.getByText('Add Supplier')).toBeInTheDocument();
    });
  });
});
