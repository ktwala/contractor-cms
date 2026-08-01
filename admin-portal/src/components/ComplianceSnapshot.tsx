import { Link } from 'react-router-dom';
import { Card, ui } from '../ui/layout';
import * as styles from '../styles/common';
import type { ComplianceSummary } from '../hooks/useDashboardWidgets';

type Props = { data: ComplianceSummary | null; loading: boolean };

const statusBadge = (s: string) => {
  const c = s === 'READY' ? '#22c55e' : s === 'DUE_SOON' ? '#eab308' : s === 'OVERDUE' ? '#ef4444' : '#64748b';
  return <span style={{ fontSize: 11, fontWeight: 600, color: c, textTransform: 'uppercase' }}>{s.replace(/_/g, ' ')}</span>;
};

export default function ComplianceSnapshot({ data, loading }: Props) {
  return (
    <Card>
      <div style={{ padding: ui.space.lg }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: styles.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: ui.space.md }}>
          Compliance snapshot
        </div>
        {loading && <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>Loading…</div>}
        {!loading && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.sm, marginBottom: ui.space.md }}>
            {data.emp201 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span>EMP201</span>
                <span>{statusBadge(data.emp201.status)}{data.emp201.due_date && ` · ${data.emp201.due_date}`}</span>
              </div>
            )}
            {data.irp5 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span>IRP5</span>
                <span>{statusBadge(data.irp5.status)}</span>
              </div>
            )}
            <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
              Tax tables: {data.tax_tables_configured ? 'Configured' : 'Not configured'}
            </div>
          </div>
        )}
        <Link to="/payroll/sars-reports" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
          View compliance →
        </Link>
      </div>
    </Card>
  );
}
