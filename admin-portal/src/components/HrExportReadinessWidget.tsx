import { Link } from 'react-router-dom';
import { Card, ui } from '../ui/layout';
import * as styles from '../styles/common';
import type { HrExportReadiness } from '../hooks/useDashboardWidgets';

type Props = { data: HrExportReadiness | null; loading: boolean };

const statusColor = (s: string) => (s === 'READY' ? '#22c55e' : s === 'READY_WITH_WARNINGS' ? '#eab308' : '#ef4444');

export default function HrExportReadinessWidget({ data, loading }: Props) {
  return (
    <Card>
      <div style={{ padding: ui.space.lg }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: styles.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: ui.space.md }}>
          HR export / IGA readiness
        </div>
        {loading && <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>Loading…</div>}
        {!loading && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.sm, marginBottom: ui.space.md }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: statusColor(data.status) }}>
              {data.status.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
              {data.exportable_employees} exportable employees
            </div>
            {data.warnings > 0 && (
              <div style={{ fontSize: 12, color: '#eab308' }}>{data.warnings} warning(s)</div>
            )}
            {data.issues && data.issues.length > 0 && (
              <div style={{ fontSize: 12, color: styles.colors.textSecondary }}>
                {data.issues.map((i) => `${i.code}: ${i.count}`).join(', ')}
              </div>
            )}
          </div>
        )}
        <Link to="/enterprise/hr-export" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
          Validate HR export →
        </Link>
      </div>
    </Card>
  );
}
