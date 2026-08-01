/**
 * hcm-workforce-cutover-panel.spec.tsx
 * PR-GOV-SIGNAL-LIFECYCLE-2 — Render-level tests for WorkforceCutoverPanel.
 *
 * Verifies:
 * - NO_CUTOVER state: date picker visible, no current-date display
 * - PRE_CUTOVER state: date shown, no confirm dialog on clear
 * - POST_CUTOVER state: warning badge, confirm dialog required before clear
 * - setWorkforceCutover called with ISO string on submit
 * - setWorkforceCutover called with null on confirmed clear
 * - onCutoverChanged fires after successful save
 * - Invariant error (400) renders inline with role=alert
 * - Panel hidden when canManage=false
 * - Correct governance-phase banner text in each state
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkforceCutoverPanel from '../components/contractor-sources/WorkforceCutoverPanel';
import { api } from '../lib/api';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../lib/api', () => ({
  api: {
    getWorkforceCutover: jest.fn(),
    setWorkforceCutover: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
});


// ── Helpers ───────────────────────────────────────────────────────────────────

function noCutoverPayload() {
  return {
    workforceMigrationCutoverAt: null,
    updatedAt: new Date().toISOString(),
    governancePhase: 'NO_CUTOVER' as const,
  };
}

function preCutoverPayload(date = '2099-12-31') {
  return {
    workforceMigrationCutoverAt: `${date}T00:00:00.000Z`,
    updatedAt: new Date().toISOString(),
    governancePhase: 'PRE_CUTOVER' as const,
  };
}

function postCutoverPayload(date = '2020-01-01') {
  return {
    workforceMigrationCutoverAt: `${date}T00:00:00.000Z`,
    updatedAt: new Date().toISOString(),
    governancePhase: 'POST_CUTOVER' as const,
  };
}

async function renderPanel(opts: {
  canManage?: boolean;
  initial?: ReturnType<typeof noCutoverPayload>;
  onCutoverChanged?: () => void;
}) {
  const { canManage = true, initial = noCutoverPayload(), onCutoverChanged } = opts;
  mockApi.getWorkforceCutover.mockResolvedValue(initial);
  render(
    <WorkforceCutoverPanel canManage={canManage} onCutoverChanged={onCutoverChanged} />,
  );
  // Wait for initial load to settle
  await waitFor(() =>
    expect(screen.queryByText(/Loading cutover state/)).not.toBeInTheDocument(),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WorkforceCutoverPanel — NO_CUTOVER state', () => {
  it('renders date input and declare button', async () => {
    await renderPanel({ initial: noCutoverPayload() });
    expect(screen.getByTestId('cutover-date-input')).toBeInTheDocument();
    expect(screen.getByTestId('cutover-submit-btn')).toBeInTheDocument();
  });

  it('does NOT render clear button when no cutover set', async () => {
    await renderPanel({ initial: noCutoverPayload() });
    expect(screen.queryByTestId('cutover-clear-btn')).not.toBeInTheDocument();
  });

  it('renders NO_CUTOVER banner text', async () => {
    await renderPanel({ initial: noCutoverPayload() });
    expect(
      screen.getByText(/Bootstrap lineage visible.*workforce cutover not declared/i),
    ).toBeInTheDocument();
  });

  it('phase badge reads "No cutover"', async () => {
    await renderPanel({ initial: noCutoverPayload() });
    expect(screen.getByTestId('cutover-phase-badge')).toHaveTextContent(/No cutover/i);
  });
});

describe('WorkforceCutoverPanel — PRE_CUTOVER state', () => {
  it('renders PRE_CUTOVER banner text', async () => {
    await renderPanel({ initial: preCutoverPayload() });
    expect(
      screen.getByText(/Pre-cutover.*bootstrap governance remains active/i),
    ).toBeInTheDocument();
  });

  it('renders clear button', async () => {
    await renderPanel({ initial: preCutoverPayload() });
    expect(screen.getByTestId('cutover-clear-btn')).toBeInTheDocument();
  });

  it('clear on PRE_CUTOVER does NOT show confirm dialog — calls API directly', async () => {
    const onChanged = jest.fn();
    mockApi.setWorkforceCutover.mockResolvedValue(noCutoverPayload());
    await renderPanel({ initial: preCutoverPayload(), onCutoverChanged: onChanged });

    fireEvent.click(screen.getByTestId('cutover-clear-btn'));

    // No confirm dialog should appear
    expect(screen.queryByTestId('cutover-confirm-dialog')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockApi.setWorkforceCutover).toHaveBeenCalledWith(null);
    });
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('WorkforceCutoverPanel — POST_CUTOVER state', () => {
  it('renders POST_CUTOVER banner text', async () => {
    await renderPanel({ initial: postCutoverPayload() });
    expect(
      screen.getByText(/Post-cutover.*operational governance prioritized/i),
    ).toBeInTheDocument();
  });

  it('phase badge reads "Post-cutover"', async () => {
    await renderPanel({ initial: postCutoverPayload() });
    expect(screen.getByTestId('cutover-phase-badge')).toHaveTextContent(/Post-cutover/i);
  });

  it('clear on POST_CUTOVER shows confirmation dialog before calling API', async () => {
    await renderPanel({ initial: postCutoverPayload() });

    fireEvent.click(screen.getByTestId('cutover-clear-btn'));

    // Confirm dialog should appear — no API call yet
    expect(screen.getByTestId('cutover-confirm-dialog')).toBeInTheDocument();
    expect(mockApi.setWorkforceCutover).not.toHaveBeenCalled();
  });

  it('confirming the POST_CUTOVER clear calls setWorkforceCutover(null)', async () => {
    const onChanged = jest.fn();
    mockApi.setWorkforceCutover.mockResolvedValue(noCutoverPayload());
    await renderPanel({ initial: postCutoverPayload(), onCutoverChanged: onChanged });

    // Open confirmation
    fireEvent.click(screen.getByTestId('cutover-clear-btn'));
    expect(screen.getByTestId('cutover-confirm-dialog')).toBeInTheDocument();

    // Confirm
    fireEvent.click(screen.getByText(/Yes, clear cutover/i));

    await waitFor(() => {
      expect(mockApi.setWorkforceCutover).toHaveBeenCalledWith(null);
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('cancelling the confirm dialog does not call API', async () => {
    await renderPanel({ initial: postCutoverPayload() });

    fireEvent.click(screen.getByTestId('cutover-clear-btn'));
    fireEvent.click(screen.getByText(/Cancel/i));

    expect(mockApi.setWorkforceCutover).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cutover-confirm-dialog')).not.toBeInTheDocument();
  });
});

describe('WorkforceCutoverPanel — submit', () => {
  it('calls setWorkforceCutover with ISO string on submit', async () => {
    const onChanged = jest.fn();
    mockApi.setWorkforceCutover.mockResolvedValue(preCutoverPayload('2099-06-01'));
    await renderPanel({ initial: noCutoverPayload(), onCutoverChanged: onChanged });

    fireEvent.change(screen.getByTestId('cutover-date-input'), {
      target: { value: '2099-06-01' },
    });
    fireEvent.click(screen.getByTestId('cutover-submit-btn'));

    await waitFor(() => {
      expect(mockApi.setWorkforceCutover).toHaveBeenCalledWith(
        '2099-06-01T00:00:00.000Z',
      );
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('submit button is disabled when date input is empty', async () => {
    await renderPanel({ initial: noCutoverPayload() });
    expect(screen.getByTestId('cutover-submit-btn')).toBeDisabled();
  });
});

describe('WorkforceCutoverPanel — error handling', () => {
  it('renders invariant error inline with role=alert when API returns 400', async () => {
    const err = { response: { data: { message: 'Cannot declare cutover with no materialized contractors.' } } };
    mockApi.setWorkforceCutover.mockRejectedValue(err);
    await renderPanel({ initial: noCutoverPayload() });

    fireEvent.change(screen.getByTestId('cutover-date-input'), {
      target: { value: '2099-01-01' },
    });
    fireEvent.click(screen.getByTestId('cutover-submit-btn'));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/no materialized contractors/i);
    });
  });
});

describe('WorkforceCutoverPanel — access control', () => {
  it('renders nothing when canManage=false', () => {
    // When canManage=false the component returns null before mounting the
    // useEffect, so getWorkforceCutover must never be called.
    render(<WorkforceCutoverPanel canManage={false} />);
    expect(screen.queryByTestId('cutover-panel')).not.toBeInTheDocument();
    expect(mockApi.getWorkforceCutover).not.toHaveBeenCalled();
  });
});
