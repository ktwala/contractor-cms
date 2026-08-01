import { Link } from 'react-router-dom';
import { Card, ui } from '../ui/layout';
import * as styles from '../styles/common';

type WorkforceStatsProps = {
  employees: number;
  employments: number;
};

const formatCount = (n: number) => (n === null || n === undefined ? '—' : String(n));

export default function WorkforceStats({ employees, employments }: WorkforceStatsProps) {
  return (
    <Card>
      <div style={{ padding: ui.space.lg }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: styles.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: ui.space.md }}>
          Workforce snapshot
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: ui.space.lg, marginBottom: ui.space.md }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: styles.colors.textPrimary }}>{formatCount(employees)}</div>
            <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>Employees</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: styles.colors.textPrimary }}>{formatCount(employments)}</div>
            <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>Employments</div>
          </div>
        </div>
        <Link to="/enterprise/employees" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
          View workforce →
        </Link>
      </div>
    </Card>
  );
}
