import { Link } from 'react-router-dom';
import { Card, ui } from '../ui/layout';
import * as styles from '../styles/common';
import type { DataImportsSummary } from '../hooks/useDashboardWidgets';

type Props = { data: DataImportsSummary | null; loading: boolean };

export default function DataImportsWidget({ data, loading }: Props) {
  return (
    <Card>
      <div style={{ padding: ui.space.lg }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: styles.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: ui.space.md }}>
          Data imports
        </div>
        {loading && <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>Loading…</div>}
        {!loading && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.sm, marginBottom: ui.space.md }}>
            {data.latest_job ? (
              <>
                <div style={{ fontSize: 13 }}>Latest: {data.latest_job.name}</div>
                <div style={{ fontSize: 12, color: styles.colors.textSecondary }}>
                  Status: {data.latest_job.status}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>No imports yet</div>
            )}
            {(data.rejected_rows > 0 || data.pending_jobs > 0) && (
              <div style={{ fontSize: 12, color: data.rejected_rows > 0 ? '#ef4444' : styles.colors.textSecondary }}>
                {data.rejected_rows > 0 && `${data.rejected_rows} rejected rows`}
                {data.rejected_rows > 0 && data.pending_jobs > 0 && ' · '}
                {data.pending_jobs > 0 && `${data.pending_jobs} pending jobs`}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/enterprise/data-imports/wizard" style={{ fontSize: 13, color: styles.colors.primary, fontWeight: 600, textDecoration: 'none' }}>
            Import Wizard →
          </Link>
          <Link to="/enterprise/data-imports" style={{ fontSize: 13, color: styles.colors.textSecondary, fontWeight: 500, textDecoration: 'none' }}>
            View console →
          </Link>
        </div>
      </div>
    </Card>
  );
}
