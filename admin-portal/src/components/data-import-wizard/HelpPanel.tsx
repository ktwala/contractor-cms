import { Link } from 'react-router-dom';
import * as styles from '../../styles/common';
import { ui } from '../../ui/layout';

const PANEL_STYLE: React.CSSProperties = {
  position: 'sticky',
  top: 80,
  alignSelf: 'flex-start',
  minWidth: 240,
  maxWidth: 280,
  padding: ui.space.lg,
  background: styles.colors.cardBg,
  border: `1px solid ${styles.colors.border}`,
  borderRadius: ui.radius.md,
  fontSize: 13,
};

export default function HelpPanel({
  dataset,
  rules,
  showConsoleLink = true,
}: {
  dataset: 'EMPLOYEES' | 'EMPLOYMENTS' | 'MANAGER_RELATIONSHIPS' | null;
  rules?: string[];
  showConsoleLink?: boolean;
}) {
  return (
    <div style={PANEL_STYLE}>
      <div style={{ fontWeight: 700, color: styles.colors.textPrimary, marginBottom: ui.space.sm }}>
        Help
      </div>
      {dataset && (
        <div style={{ marginBottom: ui.space.md }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: styles.colors.textMuted, marginBottom: 4 }}>
            Current dataset
          </div>
          <div style={{ color: styles.colors.textPrimary }}>{dataset.replace(/_/g, ' ')}</div>
        </div>
      )}
      {rules && rules.length > 0 && (
        <div style={{ marginBottom: ui.space.md }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: styles.colors.textMuted, marginBottom: 4 }}>
            Validation rules
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, color: styles.colors.textSecondary }}>
            {rules.map((r, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ fontSize: 11, color: styles.colors.textMuted, marginBottom: 6 }}>
        UTF-8 CSV, one row per record. Do not rename required columns.
      </div>
      {showConsoleLink && (
        <Link
          to="/enterprise/data-imports"
          style={{
            display: 'inline-block',
            fontSize: 12,
            fontWeight: 600,
            color: styles.colors.primary,
            textDecoration: 'none',
            marginTop: ui.space.sm,
          }}
        >
          Open Data Imports Console →
        </Link>
      )}
    </div>
  );
}
