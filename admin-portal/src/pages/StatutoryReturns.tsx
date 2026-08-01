import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, Banner } from '../ui/layout';

interface ReturnItem {
  item_code: string;
  item_label: string;
  amount: number;
  currency: string;
  employee_count?: number;
}

interface StatutoryReturn {
  id: string;
  country_code: string;
  legal_entity_id: string;
  return_code: string;
  return_label: string;
  period_key: string;
  currency: string;
  status: string;
  total_due: number;
  employee_count: number;
  source_payrun_ids: string[];
  statutory_profile_key: string;
  generated_at?: string;
  filing_due_date?: string;
  filing_authority?: string;
  days_until_due?: number;
  is_overdue?: boolean;
  version_number: number;
  items: ReturnItem[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f1f5f9', text: '#475569' },
  under_review: { bg: '#fef3c7', text: '#d97706' },
  approved: { bg: '#dbeafe', text: '#2563eb' },
  submitted: { bg: '#e0e7ff', text: '#4338ca' },
  acknowledged: { bg: '#f0fdf4', text: '#16a34a' },
  amended: { bg: '#fef3c7', text: '#b45309' },
  cancelled: { bg: '#fef2f2', text: '#dc2626' },
};

function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#475569' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: c.bg, color: c.text, textTransform: 'capitalize' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function StatutoryReturns() {
  const [returns, setReturns] = useState<StatutoryReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterCountry) params.set('country_code', filterCountry);
      if (filterStatus) params.set('status', filterStatus);
      const res = await api.get(`/payroll/statutory/returns?${params.toString()}`);
      setReturns(res.data?.data ?? []);
    } catch {
      setError('Failed to load statutory returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterCountry, filterStatus]);

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 8, border: `1px solid ${styles.colors.border}`,
    fontSize: 13, background: '#fff', minWidth: 120,
  };

  if (loading) {
    return <Page title="Statutory Returns"><div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div><style>{styles.spinKeyframes}</style></Page>;
  }

  return (
    <Page
      title="Statutory Returns"
      subtitle="Generated monthly statutory returns from normalized payroll results."
    >
      {error && <Banner variant="error">{error}</Banner>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} style={selectStyle}>
          <option value="">All Countries</option>
          <option value="ZA">South Africa</option>
          <option value="LS">Lesotho</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="submitted">Submitted</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <Card>
        {returns.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: styles.colors.textMuted, fontSize: 14 }}>
            No statutory returns found. Generate returns from a finalized payrun.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px' }}>Return Type</th>
                  <th style={{ padding: '10px 16px' }}>Country</th>
                  <th style={{ padding: '10px 16px' }}>Period</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Total Due</th>
                  <th style={{ padding: '10px 16px' }}>Status</th>
                  <th style={{ padding: '10px 16px' }}>Due Date</th>
                  <th style={{ padding: '10px 16px' }}>Time Left</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}
                    onClick={() => navigate(`/payroll/statutory-returns/${r.id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                      <div>{r.return_code} <span style={{ fontSize: 10, color: styles.colors.textMuted, fontWeight: 400 }}>v{r.version_number}</span></div>
                      <div style={{ fontSize: 11, fontWeight: 400, color: styles.colors.textMuted }}>{r.return_label}</div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: r.country_code === 'ZA' ? '#dbeafe' : '#f0fdf4', color: r.country_code === 'ZA' ? '#1d4ed8' : '#15803d' }}>
                        {r.country_code}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{r.period_key}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCurrency(r.total_due, r.currency)}
                    </td>
                    <td style={{ padding: '10px 16px' }}><StatusChip status={r.status} /></td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: styles.colors.textMuted }}>
                      {r.filing_due_date ? fmtDate(r.filing_due_date) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {r.days_until_due != null ? (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                          background: r.is_overdue ? '#fef2f2' : r.days_until_due <= 5 ? '#fef3c7' : '#f0fdf4',
                          color: r.is_overdue ? '#dc2626' : r.days_until_due <= 5 ? '#d97706' : '#16a34a',
                        }}>
                          {r.is_overdue ? `${Math.abs(r.days_until_due)}d overdue` : `${r.days_until_due}d left`}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
