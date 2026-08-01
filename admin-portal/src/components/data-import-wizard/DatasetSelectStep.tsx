import * as styles from '../../styles/common';
import { ui } from '../../ui/layout';

type DatasetType = 'EMPLOYEES' | 'EMPLOYMENTS' | 'MANAGER_RELATIONSHIPS';

type Props = {
  onSelect: (dataset: DatasetType) => void;
  employmentsReady: boolean;
  managersReady: boolean;
};

const CARD_STYLE: React.CSSProperties = {
  cursor: 'pointer',
  padding: ui.space.lg,
  border: `2px solid ${styles.colors.border}`,
  borderRadius: ui.radius.md,
  transition: 'all 0.2s ease',
  minHeight: 140,
};

export default function DatasetSelectStep({ onSelect, employmentsReady, managersReady }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: ui.space.lg }}>
      <button
        type="button"
        onClick={() => onSelect('EMPLOYEES')}
        style={{
          ...CARD_STYLE,
          textAlign: 'left',
          background: 'white',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = styles.colors.primary;
          e.currentTarget.style.boxShadow = styles.shadows.cardHover;
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = styles.colors.border;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, color: styles.colors.textPrimary, marginBottom: 8 }}>
          Employees
        </div>
        <div style={{ fontSize: 13, color: styles.colors.textSecondary, marginBottom: 12 }}>
          Import employee master records. Used for workforce identity and downstream HR export.
        </div>
        <div style={{ fontSize: 12, color: styles.colors.textMuted }}>
          Prerequisites: none
        </div>
        <div style={{ marginTop: 12, fontWeight: 600, color: styles.colors.primary, fontSize: 13 }}>
          Select Employees →
        </div>
      </button>

      <button
        type="button"
        onClick={() => employmentsReady && onSelect('EMPLOYMENTS')}
        disabled={!employmentsReady}
        style={{
          ...CARD_STYLE,
          textAlign: 'left',
          background: employmentsReady ? 'white' : styles.colors.background,
          opacity: employmentsReady ? 1 : 0.7,
          cursor: employmentsReady ? 'pointer' : 'not-allowed',
        }}
        onMouseOver={(e) => {
          if (employmentsReady) {
            e.currentTarget.style.borderColor = styles.colors.primary;
            e.currentTarget.style.boxShadow = styles.shadows.cardHover;
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = styles.colors.border;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, color: styles.colors.textPrimary, marginBottom: 8 }}>
          Employments
        </div>
        <div style={{ fontSize: 13, color: styles.colors.textSecondary, marginBottom: 12 }}>
          Import legal entity, pay group, and employment records. Used for payroll readiness and IGA.
        </div>
        <div style={{ fontSize: 12, color: employmentsReady ? styles.colors.success : styles.colors.textMuted }}>
          Prerequisites: Employees, Legal Entities, Pay Groups
          {!employmentsReady && ' (not yet complete)'}
        </div>
        <div
          style={{
            marginTop: 12,
            fontWeight: 600,
            color: employmentsReady ? styles.colors.primary : styles.colors.textMuted,
            fontSize: 13,
          }}
        >
          {employmentsReady ? 'Select Employments →' : 'Complete prerequisites first'}
        </div>
      </button>

      <button
        type="button"
        onClick={() => managersReady && onSelect('MANAGER_RELATIONSHIPS')}
        disabled={!managersReady}
        style={{
          ...CARD_STYLE,
          textAlign: 'left',
          background: managersReady ? 'white' : styles.colors.background,
          opacity: managersReady ? 1 : 0.7,
          cursor: managersReady ? 'pointer' : 'not-allowed',
        }}
        onMouseOver={(e) => {
          if (managersReady) {
            e.currentTarget.style.borderColor = styles.colors.primary;
            e.currentTarget.style.boxShadow = styles.shadows.cardHover;
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = styles.colors.border;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, color: styles.colors.textPrimary, marginBottom: 8 }}>
          Manager Hierarchy
        </div>
        <div style={{ fontSize: 13, color: styles.colors.textSecondary, marginBottom: 12 }}>
          Import reporting lines for employees. Used for manager approvals and IGA workflows.
        </div>
        <div style={{ fontSize: 12, color: managersReady ? styles.colors.success : styles.colors.textMuted }}>
          Prerequisites: Employees (required), Employments and Org Units (recommended)
          {!managersReady && ' (not yet complete)'}
        </div>
        <div
          style={{
            marginTop: 12,
            fontWeight: 600,
            color: managersReady ? styles.colors.primary : styles.colors.textMuted,
            fontSize: 13,
          }}
        >
          {managersReady ? 'Select Manager Hierarchy →' : 'Complete prerequisites first'}
        </div>
      </button>
    </div>
  );
}
