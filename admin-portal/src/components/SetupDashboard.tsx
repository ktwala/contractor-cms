import { Link } from 'react-router-dom';
import { Card, Section, ui } from '../ui/layout';
import * as styles from '../styles/common';

type SetupProgressData = {
  summary: { completed: number; total: number; is_complete: boolean };
  items: { key: string; label: string; count: number; status: string; href?: string }[];
};

type Props = { data?: SetupProgressData | null };

export default function SetupDashboard({ data }: Props) {
  if (!data) return null;
  if (data.summary?.is_complete) return null;

  return (
    <Section title="Setup progress" subtitle="Complete these steps to make your organisation demo-ready.">
      <Card>
        <div style={{ padding: ui.space.lg, display: 'grid', gap: ui.space.md }}>
          {data.items.map((item) => {
            const ready = item.status === 'READY';
            return (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${styles.colors.borderLight}`,
                background: ready ? 'rgba(34,197,94,0.04)' : 'transparent',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: styles.colors.textPrimary }}>{item.label}</div>
                <div style={{ fontSize: 12, color: styles.colors.textSecondary, marginTop: 2 }}>
                  {item.count} {item.count === 1 ? 'record' : 'records'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: ready ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
                    color: ready ? 'rgba(22,101,52,0.95)' : 'rgba(29,78,216,0.95)',
                  }}
                >
                  {item.status === 'READY' ? 'Ready' : item.status === 'IN_PROGRESS' ? 'In progress' : 'Not started'}
                </span>
                {item.href && (
                  <Link to={item.href} style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 12, padding: '6px 12px' }}>
                    Go
                  </Link>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </Card>
    </Section>
  );
}
