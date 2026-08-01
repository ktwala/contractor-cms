import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, Banner } from '../ui/layout';
import { classifyPageState } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageStateView } from '../ui/PageStateViews';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#f1f5f9', text: '#475569' },
  SNAPSHOT: { bg: '#eff6ff', text: '#2563eb' },
  CALCULATING: { bg: '#fef3c7', text: '#d97706' },
  CALCULATED: { bg: '#dbeafe', text: '#1d4ed8' },
  IN_REVIEW: { bg: '#fef9c3', text: '#ca8a04' },
  APPROVED: { bg: '#dcfce7', text: '#16a34a' },
  PAID: { bg: '#d1fae5', text: '#059669' },
  POSTED: { bg: '#e0e7ff', text: '#4f46e5' },
  FINALIZED: { bg: '#f0fdf4', text: '#15803d' },
  CANCELLED: { bg: '#fef2f2', text: '#dc2626' },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#475569' };
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: c.bg, color: c.text }}>{status.replace(/_/g, ' ')}</span>;
}

const ALL_STATUSES = ['DRAFT', 'SNAPSHOT', 'CALCULATING', 'CALCULATED', 'IN_REVIEW', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED', 'CANCELLED'];

export default function PayrunsList() {
  const navigate = useNavigate();
  const { can } = useAccess();
  const [payruns, setPayruns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [payGroups, setPayGroups] = useState<any[]>([]);
  const [pgFilter, setPgFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const params: any = { limit: pageSize, offset: (page - 1) * pageSize };
      if (statusFilter) params.status = statusFilter;
      if (pgFilter) params.pay_group_id = pgFilter;

      const [prRes, pgRes] = await Promise.all([
        api.get('/payruns', { params }),
        api.get('/pay-groups?limit=200'),
      ]);
      const items = prRes.data?.items ?? prRes.data ?? [];
      const pgs = pgRes.data?.items ?? pgRes.data ?? [];
      setPayGroups(Array.isArray(pgs) ? pgs : []);
      setTotal(prRes.data?.total ?? items.length);
      const pgMap = new Map<string, any>(pgs.map((pg: any) => [pg.id, pg]));

      const enriched = (Array.isArray(items) ? items : []).map((pr: any) => {
        const pg = pgMap.get(pr.payGroupId ?? pr.pay_group_id);
        return { ...pr, _pgName: pg?.name, _pgCode: pg?.code, _leName: pg?.legalEntity?.name ?? pg?.legal_entity_name };
      });
      setPayruns(enriched);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pgFilter, page]);

  useEffect(() => { void loadData(); }, [loadData]);

  const pageState = classifyPageState({ loading, error: loadError, data: payruns });
  usePageStateTelemetry('payroll.payruns.list', 'payroll', pageState);
  const statusCounts: Record<string, number> = {};
  for (const pr of payruns) statusCounts[pr.status] = (statusCounts[pr.status] ?? 0) + 1;

  return (
    <Page
      title="Payruns"
      subtitle="Create, track, and manage payroll runs across entities and periods."
      actions={can('payrun:create') ? <button style={styles.buttonPrimary} onClick={() => navigate('/payroll/payruns/new')}>Create Payrun</button> : undefined}
    >
      {pageState.kind === 'loading' ? (
        <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>
      ) : pageState.kind !== 'ready' ? (
        <PageStateView
          state={pageState}
          page="payroll.payruns.list"
          module="payroll"
          emptyTitle="No payruns found"
          emptyAction={can('payrun:create') ? <button style={styles.buttonPrimary} onClick={() => navigate('/payroll/payruns/new')}>Create Payrun</button> : undefined}
        />
      ) : (
        <>
          {/* KPI strip */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setStatusFilter('')} style={{ padding: '6px 14px', borderRadius: 999, border: `1px solid ${!statusFilter ? styles.colors.primary : styles.colors.border}`, background: !statusFilter ? styles.colors.primary : '#fff', color: !statusFilter ? '#fff' : styles.colors.textPrimary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              All ({payruns.length})
            </button>
            {ALL_STATUSES.filter((s) => statusCounts[s]).map((s) => (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)} style={{ padding: '6px 14px', borderRadius: 999, border: `1px solid ${statusFilter === s ? styles.colors.primary : styles.colors.border}`, background: statusFilter === s ? styles.colors.primary : '#fff', color: statusFilter === s ? '#fff' : styles.colors.textPrimary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {s.replace(/_/g, ' ')} ({statusCounts[s]})
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <select value={pgFilter} onChange={(e) => setPgFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13 }}>
              <option value="">All Pay Groups</option>
              {payGroups.map((pg: any) => <option key={pg.id} value={pg.id}>{pg.name} ({pg.code})</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13 }}>
              <option value="">All Statuses</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>Payrun</th>
                    <th style={styles.tableHeaderCell}>Pay Group</th>
                    <th style={styles.tableHeaderCell}>Legal Entity</th>
                    <th style={styles.tableHeaderCell}>Period</th>
                    <th style={styles.tableHeaderCell}>Pay Date</th>
                    <th style={styles.tableHeaderCell}>Type</th>
                    <th style={styles.tableHeaderCell}>Status</th>
                    <th style={styles.tableHeaderCell}>Updated</th>
                    <th style={styles.tableHeaderCell}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payruns.map((pr: any) => (
                    <tr key={pr.id} style={{ ...styles.tableRow, cursor: 'pointer' }} onClick={() => navigate(`/payroll/payruns/${pr.id}`)}>
                      <td style={styles.tableCell}>
                        <div style={{ fontWeight: 500 }}>{pr._pgName ?? 'Payrun'}</div>
                        <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{pr.id.slice(0, 8)}</div>
                      </td>
                      <td style={styles.tableCell}>{pr._pgCode ?? '—'}</td>
                      <td style={styles.tableCell}>{pr._leName ?? '—'}</td>
                      <td style={styles.tableCell}>
                        {(pr.periodStart ?? pr.period_start) ? `${new Date(pr.periodStart ?? pr.period_start).toLocaleDateString()} – ${new Date(pr.periodEnd ?? pr.period_end).toLocaleDateString()}` : '—'}
                      </td>
                      <td style={styles.tableCell}>{(pr.payDate ?? pr.pay_date) ? new Date(pr.payDate ?? pr.pay_date).toLocaleDateString() : '—'}</td>
                      <td style={styles.tableCell}><span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{pr.payrunType ?? pr.payrun_type ?? 'REGULAR'}</span></td>
                      <td style={styles.tableCell}><StatusBadge status={pr.status} /></td>
                      <td style={styles.tableCell}>{new Date(pr.updatedAt ?? pr.updated_at).toLocaleDateString()}</td>
                      <td style={styles.tableCell}>
                        <Link to={`/payroll/payruns/${pr.id}`} style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 12 }} onClick={(e) => e.stopPropagation()}>Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {total > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <span style={{ fontSize: 12, color: styles.colors.textMuted }}>Showing {(page-1)*pageSize+1}–{Math.min(page*pageSize, total)} of {total}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={styles.buttonSecondary} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                <button style={styles.buttonSecondary} disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
