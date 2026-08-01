import { useState } from 'react';
import { Page, Card } from '../ui/layout';
import {
  PageStateView,
  PageErrorView,
  PageBlockedView,
  PageEmptyView,
} from '../ui/PageStateViews';
import type { PageState } from '../utils/pageState';

type Fixture = {
  label: string;
  group: 'error' | 'blocked' | 'empty' | 'loading' | 'transition';
  state: PageState;
  emptyTitle?: string;
  emptyMessage?: string;
};

const FIXTURES: Fixture[] = [
  // ─── Error ──────────────────────────────────────────────
  {
    label: 'Retryable 500 / server failure',
    group: 'error',
    state: { kind: 'error', message: 'Internal server error. The payroll engine could not process the request.', code: 'INTERNAL_ERROR', status: 500, retryable: true },
  },
  {
    label: 'Non-retryable known failure',
    group: 'error',
    state: { kind: 'error', message: 'The requested payrun could not be found. It may have been deleted.', code: 'NOT_FOUND', status: 404, retryable: false },
  },
  {
    label: 'Network failure',
    group: 'error',
    state: { kind: 'error', message: 'Unable to connect to the server. Check your network.', code: 'NETWORK_ERROR', status: 0, retryable: true },
  },
  {
    label: 'Bad request (validation)',
    group: 'error',
    state: { kind: 'error', message: 'The period start date must be before the period end date.', code: 'VALIDATION_ERROR', status: 400, retryable: false },
  },

  // ─── Blocked ────────────────────────────────────────────
  {
    label: 'Setup required — Legal entity',
    group: 'blocked',
    state: { kind: 'blocked', code: 'PAYROLL_LEGAL_ENTITY_REQUIRED', message: 'No legal entity access assigned to this user.', icon: 'setup', ctaLabel: 'Go to Legal Entities', ctaHref: '/admin/legal-entities' },
  },
  {
    label: 'Setup required — Pay groups',
    group: 'blocked',
    state: { kind: 'blocked', code: 'PAYROLL_NO_PAY_GROUPS', message: 'No pay groups configured.', icon: 'setup', ctaLabel: 'Go to Pay Groups', ctaHref: '/admin/pay-groups' },
  },
  {
    label: 'Setup required — Employees',
    group: 'blocked',
    state: { kind: 'blocked', code: 'PAYROLL_NO_EMPLOYEES', message: 'No employees found.', icon: 'setup', ctaLabel: 'Go to Employees', ctaHref: '/admin/employees' },
  },
  {
    label: 'Access restricted — RBAC',
    group: 'blocked',
    state: { kind: 'blocked', code: 'FORBIDDEN', message: 'You do not have permission to access this feature.', icon: 'lock' },
  },
  {
    label: 'Access restricted — Entity denied',
    group: 'blocked',
    state: { kind: 'blocked', code: 'PAYROLL_LEGAL_ENTITY_DENIED', message: 'You do not have access to the requested legal entity.', icon: 'lock' },
  },
  {
    label: 'Feature unavailable',
    group: 'blocked',
    state: { kind: 'blocked', code: 'FEATURE_NOT_AVAILABLE', message: 'This feature is not available for your organisation.', icon: 'unavailable' },
  },

  // ─── Empty ──────────────────────────────────────────────
  {
    label: 'No payruns yet',
    group: 'empty',
    state: { kind: 'empty' },
    emptyTitle: 'No payruns found',
  },
  {
    label: 'No reports yet',
    group: 'empty',
    state: { kind: 'empty' },
    emptyTitle: 'No reports generated yet',
    emptyMessage: 'Run your first payroll to see reports here.',
  },
  {
    label: 'No positions yet',
    group: 'empty',
    state: { kind: 'empty' },
    emptyTitle: 'No positions defined',
  },

  // ─── Loading ────────────────────────────────────────────
  {
    label: 'Page loading',
    group: 'loading',
    state: { kind: 'loading' },
  },
];

const GROUP_LABELS: Record<string, string> = {
  error: 'Error States',
  blocked: 'Blocked States',
  empty: 'Empty States',
  loading: 'Loading State',
  transition: 'Transitions',
};

const GROUP_ORDER = ['error', 'blocked', 'empty', 'loading', 'transition'] as const;

export default function DevPageStates() {
  const [activeGroup, setActiveGroup] = useState<string>('all');

  const filtered = activeGroup === 'all'
    ? FIXTURES
    : FIXTURES.filter((f) => f.group === activeGroup);

  return (
    <Page
      title="Page State Fixtures"
      subtitle="Visual reference for every classified page state. For development and design review only."
    >
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {['all', ...GROUP_ORDER].map((g) => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: `1px solid ${activeGroup === g ? '#4f46e5' : '#e2e8f0'}`,
              background: activeGroup === g ? '#4f46e5' : '#fff',
              color: activeGroup === g ? '#fff' : '#1e293b',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {g === 'all' ? 'All' : GROUP_LABELS[g] ?? g}
          </button>
        ))}
      </div>

      {/* Fixtures */}
      {filtered.map((fixture, idx) => (
        <div key={idx} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '2px 8px',
              borderRadius: 4,
              background: groupColor(fixture.group).bg,
              color: groupColor(fixture.group).text,
            }}>
              {fixture.group}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
              {fixture.label}
            </span>
            {fixture.state.kind === 'blocked' && 'code' in fixture.state && (
              <code style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                {fixture.state.code}
              </code>
            )}
          </div>

          {fixture.state.kind === 'loading' ? (
            <Card>
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{
                  width: 28,
                  height: 28,
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#4f46e5',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px',
                }} />
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading...</p>
              </div>
            </Card>
          ) : fixture.state.kind === 'error' ? (
            <PageErrorView
              message={fixture.state.message}
              retryable={fixture.state.retryable}
              onRetry={() => alert('Retry clicked')}
              page="dev.fixtures"
              module="dev"
              errorCode={fixture.state.code}
              httpStatus={fixture.state.status}
            />
          ) : fixture.state.kind === 'blocked' ? (
            <PageBlockedView
              code={fixture.state.code}
              message={fixture.state.message}
              page="dev.fixtures"
              module="dev"
            />
          ) : fixture.state.kind === 'empty' ? (
            <PageEmptyView
              title={fixture.emptyTitle}
              message={fixture.emptyMessage}
              page="dev.fixtures"
              module="dev"
            />
          ) : null}
        </div>
      ))}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Page>
  );
}

function groupColor(group: string) {
  switch (group) {
    case 'error':      return { bg: '#fef2f2', text: '#dc2626' };
    case 'blocked':    return { bg: '#fff7ed', text: '#ea580c' };
    case 'empty':      return { bg: '#f0fdf4', text: '#16a34a' };
    case 'loading':    return { bg: '#eff6ff', text: '#2563eb' };
    case 'transition': return { bg: '#faf5ff', text: '#9333ea' };
    default:           return { bg: '#f1f5f9', text: '#475569' };
  }
}
