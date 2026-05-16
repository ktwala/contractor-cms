import React from 'react';
import { render, screen } from '@testing-library/react';
import SettingsLayout from '@/app/settings/layout';

const mockPathname = jest.fn(() => '/settings/pdp-activation');

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

jest.mock('@/components/dashboard-layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

describe('SettingsLayout PDP shell', () => {
  it('does not render generic Settings heading on PDP activation path', () => {
    mockPathname.mockReturnValue('/settings/pdp-activation');
    render(
      <SettingsLayout>
        <div>child</div>
      </SettingsLayout>,
    );
    expect(screen.queryByRole('heading', { name: /^Settings$/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('does not render generic Settings heading on PDP exceptions path', () => {
    mockPathname.mockReturnValue('/settings/pdp-exceptions');
    render(
      <SettingsLayout>
        <div>child</div>
      </SettingsLayout>,
    );
    expect(screen.queryByRole('heading', { name: /^Settings$/ })).not.toBeInTheDocument();
  });

  it('renders Settings heading for other settings routes', () => {
    mockPathname.mockReturnValue('/settings/users');
    render(
      <SettingsLayout>
        <div>child</div>
      </SettingsLayout>,
    );
    expect(screen.getByRole('heading', { name: /^Settings$/ })).toBeInTheDocument();
  });
});
