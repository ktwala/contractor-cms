import { Link } from 'react-router-dom';
import { Card, ui } from '../ui/layout';
import * as styles from '../styles/common';

type PendingApprovalsData = {
  count?: number;
  total_pending?: number;
  my_pending?: number;
  items?: { entity_id?: string; id?: string; entity_type?: string; type?: string; description?: string; title?: string }[];
};

type Props = { data: PendingApprovalsData | null; loading?: boolean };

export default function PendingApprovalsWidget({ data, loading }: Props) {
  const count = data?.count ?? data?.total_pending ?? 0;
  const myCount = data?.my_pending ?? 0;
  const items = data?.items ?? [];

  return (
    <Card>
      <div style={{ padding: ui.space.lg }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: styles.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: ui.space.md }}>
          Pending approvals
        </div>
        {loading && <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>Loading…</div>}
        {!loading && (
          <>
            <div style={{ marginBottom: ui.space.md }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: count > 0 ? styles.colors.primary : styles.colors.textPrimary }}>{count}</div>
              <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>{myCount > 0 ? `${myCount} assigned to you` : 'Total pending'}</div>
            </div>
            {items.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.xs, marginBottom: ui.space.md, fontSize: 12, color: styles.colors.textSecondary }}>
                {items.slice(0, 3).map((i) => (
                  <div key={i.entity_id ?? i.id ?? ''}>{i.entity_type ?? i.type ?? ''} · {i.description ?? i.title ?? ''}</div>
                ))}
              </div>
            )}
            <Link to="/enterprise/approvals/pending" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
              View pending approvals →
            </Link>
          </>
        )}
      </div>
    </Card>
  );
}
