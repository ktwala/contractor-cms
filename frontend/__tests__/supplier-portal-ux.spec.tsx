import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PortalEmptyState from '@/components/supplier-portal/PortalEmptyState';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import { Users } from 'lucide-react';

describe('PR-SUPPLIER-PORTAL-UX-1', () => {
  it('PortalPageHeader shows supplier portal label', () => {
    render(
      <PortalPageHeader title="Resources" description="Scoped list" />,
    );
    expect(screen.getByText('Supplier portal')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
  });

  it('PortalEmptyState renders title and action', () => {
    render(
      <PortalEmptyState
        icon={Users}
        title="No resources yet"
        description="Nominate someone"
        action={<button type="button">Add</button>}
      />,
    );
    expect(screen.getByText('No resources yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});
