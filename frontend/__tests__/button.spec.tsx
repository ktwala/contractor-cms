import { render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

describe('Button (EWP design system)', () => {
  it('renders primary action with label and icon', () => {
    render(
      <Button variant="primary" icon={<Search data-testid="icon" />}>
        Discover workforce
      </Button>,
    );
    expect(screen.getByRole('button', { name: /discover workforce/i })).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('shows loading state and disables interaction', () => {
    render(
      <Button variant="primary" loading>
        Discover workforce
      </Button>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders toolbar variant with refresh label', () => {
    render(<Button variant="toolbar">Refresh</Button>);
    expect(screen.getByRole('button', { name: /refresh/i })).toHaveClass('border');
  });
});
