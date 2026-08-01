import { Link } from 'react-router-dom';
import { Card, ui } from '../ui/layout';
import * as styles from '../styles/common';
import type { PayrollSnapshotData } from '../hooks/useDashboardWidgets';

type Props = { data: PayrollSnapshotData | null; loading: boolean };

export default function PayrollSnapshot({ data, loading }: Props) {
  return (
    <Card>
      <div style={{ padding: ui.space.lg }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: styles.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: ui.space.md }}>
          Payroll snapshot
        </div>
        {loading && <div style={{ fontSize: 13, color: styles.colors.textSecondary, marginBottom: ui.space.md }}>Loading…</div>}
        {!loading && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.sm, marginBottom: ui.space.md }}>
            {data.setup_required && (
              <div style={{ fontSize: 13, color: '#eab308' }}>Setup required</div>
            )}
            {data.current_period && (
              <div style={{ fontSize: 13 }}>
                Current period: {data.current_period.label} · <span style={{ fontWeight: 600 }}>{data.current_period.status}</span>
              </div>
            )}
            {data.next_pay_date && (
              <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>Next pay date: {data.next_pay_date}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: ui.space.sm, fontSize: 12 }}>
              <div>Pending approvals: {data.pending_approvals}</div>
              <div>Exceptions: {data.exceptions}</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.xs, marginBottom: ui.space.md }}>
          <Link to="/enterprise/approvals/pending" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
            Pending approvals
          </Link>
          <Link to="/payroll/calendars" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
            Calendars
          </Link>
          <Link to="/payroll/checklist" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
            Checklist
          </Link>
          <Link to="/payroll/payment-batches" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
            Payment batches
          </Link>
        </div>
        <Link to="/payroll/calendars" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
          View payroll →
        </Link>
      </div>
    </Card>
  );
}
