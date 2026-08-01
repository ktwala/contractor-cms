import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner } from '../ui/layout';

interface ReturnItem {
  id: string;
  item_code: string;
  item_label: string;
  amount: number;
  currency: string;
  source_line_codes: string[];
  employee_count?: number;
  sort_order: number;
}

interface WorkflowEvent {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
  performed_by_user_id?: string;
  performed_at: string;
  comment?: string;
}

interface EvidenceBundle {
  id: string;
  artifacts: Array<{ type: string; name: string; mime_type: string; size_bytes?: number }>;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface StatutoryReturnFull {
  id: string;
  country_code: string;
  legal_entity_id: string;
  pay_group_id?: string;
  return_code: string;
  return_label: string;
  period_key: string;
  period_start: string;
  period_end: string;
  currency: string;
  status: string;
  total_due: number;
  employee_count: number;
  source_payrun_ids: string[];
  display_schema_key?: string;
  statutory_profile_key: string;
  country_pack_version?: string;
  generated_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  submitted_at?: string;
  acknowledged_at?: string;
  evidence_bundle_id?: string;
  filing_due_date?: string;
  filing_authority?: string;
  days_until_due?: number;
  is_overdue?: boolean;
  amends_return_id?: string;
  amended_by_return_id?: string;
  version_number: number;
  items: ReturnItem[];
  workflow_events?: WorkflowEvent[];
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

const ACTIONS: Record<string, { label: string; endpoint: string; color: string }[]> = {
  draft: [
    { label: 'Submit for Review', endpoint: 'submit-for-review', color: '#2563eb' },
    { label: 'Cancel', endpoint: 'cancel', color: '#dc2626' },
  ],
  under_review: [
    { label: 'Approve', endpoint: 'approve', color: '#16a34a' },
    { label: 'Cancel', endpoint: 'cancel', color: '#dc2626' },
  ],
  approved: [
    { label: 'Mark Submitted', endpoint: 'mark-submitted', color: '#4338ca' },
  ],
  submitted: [
    { label: 'Acknowledge', endpoint: 'acknowledge', color: '#16a34a' },
  ],
};

function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#475569' };
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 999, background: c.bg, color: c.text, textTransform: 'capitalize' }}>
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

export default function StatutoryReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const [ret, setRet] = useState<StatutoryReturnFull | null>(null);
  const [evidence, setEvidence] = useState<EvidenceBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/payroll/statutory/returns/${id}`);
      setRet(res.data?.data ?? res.data);

      try {
        const evRes = await api.get(`/payroll/statutory/returns/${id}/evidence`);
        setEvidence(evRes.data?.data ?? null);
      } catch {
        /* no evidence bundle */
      }
    } catch {
      setError('Failed to load statutory return');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAction = async (endpoint: string) => {
    if (!ret) return;
    setActionLoading(true);
    try {
      await api.post(`/payroll/statutory/returns/${ret.id}/${endpoint}`, {});
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!ret) return;
    try {
      const res = await api.get(`/payroll/statutory/returns/${ret.id}/export?format=${format}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers['content-type'] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ret.return_code}_${ret.period_key}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    }
  };

  if (loading) {
    return <Page title="Statutory Return"><div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div><style>{styles.spinKeyframes}</style></Page>;
  }

  if (!ret) {
    return <Page title="Statutory Return"><Banner variant="error">Return not found</Banner></Page>;
  }

  const actions = ACTIONS[ret.status] ?? [];
  const metaItems: [string, string][] = [
    ['Profile', ret.statutory_profile_key],
    ['Display Schema', ret.display_schema_key ?? '—'],
    ['Country Pack', ret.country_pack_version ?? '—'],
    ['Legal Entity', ret.legal_entity_id],
    ['Pay Group', ret.pay_group_id ?? '—'],
    ['Version', `v${ret.version_number}`],
    ['Filing Authority', ret.filing_authority ?? '—'],
    ['Filing Due Date', ret.filing_due_date ? fmtDate(ret.filing_due_date) : '—'],
  ];

  const cardStyle: React.CSSProperties = { padding: 16, background: '#fff', borderRadius: 10, border: `1px solid ${styles.colors.border}`, textAlign: 'center' };
  const cardValueStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' };

  return (
    <Page
      title={ret.return_label}
      subtitle={`${ret.return_code} · ${ret.country_code} · ${ret.period_key}`}
      actions={
        <Link to="/payroll/statutory-returns" style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>
          Back to Returns
        </Link>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <StatusChip status={ret.status} />
        <span style={{ fontSize: 12, color: styles.colors.textMuted }}>v{ret.version_number} · Generated {fmtDate(ret.generated_at)}</span>
        {actions.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {actions.map((a) => (
              <button
                key={a.endpoint}
                onClick={() => handleAction(a.endpoint)}
                disabled={actionLoading}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer', color: '#fff', background: a.color,
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filing Due Date + Amendment Info */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        {ret.filing_due_date && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 10,
            background: ret.is_overdue ? '#fef2f2' : ret.days_until_due != null && ret.days_until_due <= 5 ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${ret.is_overdue ? '#fca5a5' : ret.days_until_due != null && ret.days_until_due <= 5 ? '#fcd34d' : '#bbf7d0'}`,
            fontSize: 12,
          }}>
            <span style={{ fontWeight: 600 }}>Due:</span>
            <span>{fmtDate(ret.filing_due_date)}</span>
            {ret.filing_authority && <span style={{ color: styles.colors.textMuted }}>to {ret.filing_authority}</span>}
            {ret.days_until_due != null && (
              <span style={{
                fontWeight: 700,
                color: ret.is_overdue ? '#dc2626' : ret.days_until_due <= 5 ? '#d97706' : '#16a34a',
              }}>
                {ret.is_overdue ? `${Math.abs(ret.days_until_due)}d overdue` : `${ret.days_until_due}d left`}
              </span>
            )}
          </div>
        )}
        {ret.amends_return_id && (
          <Link to={`/payroll/statutory-returns/${ret.amends_return_id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#fef3c7', border: '1px solid #fcd34d', fontSize: 12, textDecoration: 'none', color: '#b45309', fontWeight: 500 }}>
            Amends previous return
          </Link>
        )}
        {ret.amended_by_return_id && (
          <Link to={`/payroll/statutory-returns/${ret.amended_by_return_id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #93c5fd', fontSize: 12, textDecoration: 'none', color: '#2563eb', fontWeight: 500 }}>
            Superseded by newer version
          </Link>
        )}
      </div>

      {/* Totals Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={{ ...cardValueStyle, color: '#2563eb' }}>{fmtCurrency(ret.total_due, ret.currency)}</div>
          <div style={{ fontSize: 12, color: styles.colors.textMuted }}>Total Due</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...cardValueStyle, color: '#475569' }}>{ret.employee_count}</div>
          <div style={{ fontSize: 12, color: styles.colors.textMuted }}>Employees</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...cardValueStyle, color: '#7c3aed' }}>{ret.items.length}</div>
          <div style={{ fontSize: 12, color: styles.colors.textMuted }}>Line Items</div>
        </div>
      </div>

      {/* Return Items */}
      <Card>
        <CardHeader title="Return Items" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '8px 16px' }}>Item Code</th>
                <th style={{ padding: '8px 16px' }}>Label</th>
                <th style={{ padding: '8px 16px' }}>Source Lines</th>
                <th style={{ padding: '8px 16px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '8px 16px', textAlign: 'right' }}>Employees</th>
              </tr>
            </thead>
            <tbody>
              {ret.items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 600 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569' }}>{item.item_code}</span>
                  </td>
                  <td style={{ padding: '8px 16px' }}>{item.item_label}</td>
                  <td style={{ padding: '8px 16px', fontSize: 11, color: styles.colors.textMuted }}>
                    {item.source_line_codes.join(', ')}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCurrency(item.amount, item.currency)}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right' }}>{item.employee_count ?? '—'}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                <td colSpan={3} style={{ padding: '10px 16px' }}>Total</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCurrency(ret.total_due, ret.currency)}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>{ret.employee_count}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Source Payruns */}
      <Card>
        <CardHeader title="Source Payruns" />
        <div style={{ padding: '12px 16px', fontSize: 13 }}>
          {ret.source_payrun_ids.map((prId) => (
            <Link key={prId} to={`/payroll/payruns/${prId}`} style={{ color: styles.colors.primary, marginRight: 12, fontSize: 12 }}>
              {prId}
            </Link>
          ))}
        </div>
      </Card>

      {/* Evidence Bundle */}
      {evidence && (
        <Card>
          <CardHeader title="Evidence Bundle" right={<span style={{ fontSize: 11, color: styles.colors.textMuted }}>Created {fmtDate(evidence.created_at)}</span>} />
          <div style={{ padding: '8px 16px' }}>
            {evidence.artifacts.map((art, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: i < evidence.artifacts.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{art.type}</span>
                <span style={{ fontSize: 13 }}>{art.name}</span>
                <span style={{ fontSize: 11, color: styles.colors.textMuted }}>{art.mime_type}</span>
                {art.size_bytes && <span style={{ fontSize: 11, color: styles.colors.textMuted }}>{(art.size_bytes / 1024).toFixed(1)} KB</span>}
              </div>
            ))}
          </div>
          {evidence.metadata && (
            <div style={{ padding: '8px 16px', fontSize: 11, color: styles.colors.textMuted, borderTop: '1px solid #f1f5f9' }}>
              Schema: {(evidence.metadata as any).display_schema_key ?? '—'} · Profile: {(evidence.metadata as any).statutory_profile_key ?? '—'} · Pack: {(evidence.metadata as any).country_pack_version ?? '—'}
            </div>
          )}
        </Card>
      )}

      {/* Workflow History */}
      {ret.workflow_events && ret.workflow_events.length > 0 && (
        <Card>
          <CardHeader title="Workflow History" />
          <div style={{ padding: '8px 16px' }}>
            {ret.workflow_events.map((evt) => (
              <div key={evt.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', minWidth: 140 }}>{evt.event_type}</span>
                <span style={{ fontSize: 11, color: styles.colors.textMuted }}>
                  {evt.from_status ? `${evt.from_status} →` : '→'} {evt.to_status}
                </span>
                <span style={{ fontSize: 11, color: styles.colors.textMuted, marginLeft: 'auto' }}>{fmtDate(evt.performed_at)}</span>
                {evt.comment && <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>{evt.comment}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Exports */}
      <Card>
        <CardHeader title="Export" />
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['json', 'csv', 'xlsx', 'pdf'].map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${styles.colors.border}`, background: '#fff', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              {fmt}
            </button>
          ))}
        </div>
      </Card>

      {/* Version Metadata */}
      <Card>
        <CardHeader title="Version Metadata" />
        <div style={{ padding: '8px 16px' }}>
          {metaItems.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
              <span style={{ color: styles.colors.textMuted }}>{label}</span>
              <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 12 }}>{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}
