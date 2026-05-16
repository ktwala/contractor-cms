import { render, screen } from '@testing-library/react';
import StatusBadge from '@/components/ui/status-badge';

describe('StatusBadge', () => {
  it('renders a string status correctly', () => {
    render(<StatusBadge status="ACTIVE" />);
    const badge = screen.getByText('ACTIVE');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-green-100');
  });

  it('handles null status safely without crashing', () => {
    // @ts-ignore
    render(<StatusBadge status={null} />);
    // When status is null, we return early with default gray classes and render the null text (which React ignores or renders empty)
    // The component won't crash
  });

  it('handles undefined status safely without crashing', () => {
    // @ts-ignore
    render(<StatusBadge status={undefined} />);
  });

  it('auto-detects pending status', () => {
    render(<StatusBadge status="PENDING" />);
    const badge = screen.getByText('PENDING');
    expect(badge.className).toContain('bg-yellow-100');
  });
});
