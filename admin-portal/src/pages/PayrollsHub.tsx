import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, Banner } from '../ui/layout';
import { classifyPageState } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageStateView } from '../ui/PageStateViews';

type PayrollItem = {
  id: string;
  label: string;
  tax_year_start: string;
  tax_year_end: string;
  status: string;
  pay_group: {
    id: string;
    code: string;
    name: string;
    country: string;
    frequency: string;
  };
  legal_entity: { id: string; code: string; name: string };
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  PLANNING: { bg: '#f1f5f9', fg: '#475569' },
  ACTIVE: { bg: '#dcfce7', fg: '#15803d' },
  CLOSED: { bg: '#fef9c3', fg: '#a16207' },
  ARCHIVED: { bg: '#f1f5f9', fg: '#64748b' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#f1f5f9', fg: '#475569' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}

export default function PayrollsHub() {
  const { can } = useAccess();
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [pgFilter, setPgFilter] = useState('');
  const [payGroups, setPayGroups] = useState<any[]>([]);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);

  const canView = can('pay_group:read');

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      setLoadError(null);
      const params: Record<string, string> = {};
      if (pgFilter) params.pay_group_id = pgFilter;
      const [listRes, pgRes, linkRes] = await Promise.all([
        api.get('/payrolls', { params }),
        api.get('/pay-groups', { params: { limit: '200' } }),
        api.get('/payrolls/linkage-health'),
      ]);
      const raw = listRes.data?.items ?? [];
      setItems(Array.isArray(raw) ? raw : []);
      setTotal(typeof listRes.data?.total === 'number' ? listRes.data.total : raw.length);
      const pgs = pgRes.data?.items ?? pgRes.data ?? [];
      setPayGroups(Array.isArray(pgs) ? pgs : []);
      const oc = linkRes.data?.orphan_period_count;
      setOrphanCount(typeof oc === 'number' ? oc : null);
    } catch (e) {
      setLoadError(e);
    } finally {
      setLoading(false);
    }
  }, [canView, pgFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageState = classifyPageState({ loading, error: loadError, data: items });
  usePageStateTelemetry('payroll.payrolls.hub', 'payroll', pageState);

  const hasOrphanPeriods = orphanCount !== null && orphanCount > 0;
  const emptyTitle = hasOrphanPeriods ? 'No payroll shells in this list' : 'No payroll containers yet';
  const emptyMessage = hasOrphanPeriods
    ? 'This table only shows tax-year shells. Pay periods without a linked shell stay off the list until backfill sets payroll_id — follow the warning above and docs/PAYROLL_CONTAINER_GOVERNANCE.md.'
    : 'Shells appear after backfill or when periods are linked to a tax-year window.';

  const pgOptions = useMemo(
    () =>
      [...payGroups].sort((a, b) =>
        String(a.code ?? '').localeCompare(String(b.code ?? '')),
      ),
    [payGroups],
  );

  if (!canView) {
    return (
      <Page title="Payrolls" subtitle="Tax-year payroll shells">
        <Banner variant="warning">
          You need <code style={{ padding: '0 6px' }}>pay_group:read</code> to view payroll containers.
        </Banner>
      </Page>
    );
  }

  return (
    <Page
      title="Payrolls"
      subtitle="Statutory tax-year shells (read-only). PayGroup defines workforce scope; Payroll defines the tax-year window. Close or archive a shell from its detail page (governed lifecycle; requires dedicated permissions)."
    >
      {orphanCount !== null && orphanCount > 0 && (
        <Banner variant="warning">
          <strong>{orphanCount}</strong> pay period(s) in your scope have no payroll shell (
          <code style={{ padding: '0 4px' }}>payroll_id</code> is null). Run the backfill job or review calendars — see{' '}
          <span style={{ fontWeight: 600 }}>docs/PAYROLL_CONTAINER_GOVERNANCE.md</span>.
        </Banner>
      )}

      {pageState.kind === 'loading' ? (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
        </div>
      ) : pageState.kind !== 'ready' ? (
        <PageStateView
          state={pageState}
          page="payroll.payrolls.hub"
          module="payroll"
          emptyTitle={emptyTitle}
          emptyMessage={emptyMessage}
        />
      ) : (
        <Card>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: styles.colors.textMuted }}>
              Pay group
              <select
                value={pgFilter}
                onChange={(e) => setPgFilter(e.target.value)}
                style={{
                  marginLeft: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${styles.colors.border}`,
                  fontSize: 13,
                  minWidth: 200,
                }}
              >
                <option value="">All</option>
                {pgOptions.map((pg: any) => (
                  <option key={pg.id} value={pg.id}>
                    {pg.code} — {pg.name}
                  </option>
                ))}
              </select>
            </label>
            <span style={{ fontSize: 13, color: styles.colors.textMuted }}>
              {total} container{total === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${styles.colors.border}` }}>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Label</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Legal entity</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Pay group</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Country</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Frequency</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Tax year window</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ color: styles.colors.textMuted }}>{row.legal_entity.code}</span>{' '}
                      {row.legal_entity.name}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {row.pay_group.code} — {row.pay_group.name}
                    </td>
                    <td style={{ padding: '10px 8px' }}>{row.pay_group.country}</td>
                    <td style={{ padding: '10px 8px' }}>{row.pay_group.frequency}</td>
                    <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                      {row.tax_year_start} → {row.tax_year_end}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <Link
                        to={`/payroll/payrolls/${row.id}`}
                        style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}
                      >
                        View periods
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
