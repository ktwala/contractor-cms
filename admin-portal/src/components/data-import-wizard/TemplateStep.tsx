import * as styles from '../../styles/common';
import { Card, ui } from '../../ui/layout';

type DatasetType = 'EMPLOYEES' | 'EMPLOYMENTS' | 'MANAGER_RELATIONSHIPS';

const EMPLOYEES_FIELDS = {
  required: ['employee_no', 'first_name', 'last_name', 'hire_date'],
  optional: ['email', 'national_id', 'phone', 'date_of_birth', 'country'],
  sample: 'EMP001,Jane,Doe,2026-01-15,jane.doe@example.com,,+27123456789,1990-05-20,ZA',
};

const EMPLOYMENTS_FIELDS = {
  required: ['employee_no', 'legal_entity_code', 'pay_group_code', 'hire_date', 'employment_status'],
  optional: ['job_title', 'termination_date'],
  sample: 'EMP001,LE01,PG01,2026-01-15,ACTIVE,Software Engineer,',
};

const MANAGER_RELATIONSHIPS_FIELDS = {
  required: ['employee_no'],
  optional: ['manager_employee_no'],
  sample: 'EMP001,EMP010',
};

type Props = {
  dataset: DatasetType;
  onBack: () => void;
  onContinue: () => void;
};

const TEMPLATE_MAP: Record<DatasetType, string> = {
  EMPLOYEES: '/templates/employees_template.csv',
  EMPLOYMENTS: '/templates/employments_template.csv',
  MANAGER_RELATIONSHIPS: '/templates/manager_relationships_template.csv',
};

export default function TemplateStep({ dataset, onBack, onContinue }: Props) {
  const fields =
    dataset === 'EMPLOYEES'
      ? EMPLOYEES_FIELDS
      : dataset === 'EMPLOYMENTS'
        ? EMPLOYMENTS_FIELDS
        : MANAGER_RELATIONSHIPS_FIELDS;
  const templateUrl = TEMPLATE_MAP[dataset] ?? `/templates/${dataset.toLowerCase()}_template.csv`;

  return (
    <Card>
      <div style={{ marginBottom: ui.space.lg }}>
        <div style={{ fontWeight: 700, color: styles.colors.textPrimary, marginBottom: 8 }}>
          Download Template
        </div>
        <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
          Dataset: {dataset.replace(/_/g, ' ')}
        </div>
      </div>

      <a
        href={templateUrl}
        download
        style={{
          ...styles.buttonSecondary,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
          marginBottom: ui.space.xl,
        }}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download CSV Template
      </a>

      <div style={{ marginBottom: ui.space.lg }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: styles.colors.textMuted, marginBottom: 8 }}>
          Required fields
        </div>
        <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
          {fields.required.join(', ')}
        </div>
      </div>

      <div style={{ marginBottom: ui.space.lg }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: styles.colors.textMuted, marginBottom: 8 }}>
          Optional fields
        </div>
        <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
          {fields.optional.join(', ')}
        </div>
      </div>

      <div
        style={{
          padding: 12,
          background: styles.colors.background,
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: 12,
          color: styles.colors.textSecondary,
          overflowX: 'auto',
          marginBottom: ui.space.xl,
        }}
      >
        Sample row: {fields.sample}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" style={styles.buttonSecondary} onClick={onBack}>
          Back
        </button>
        <button type="button" style={styles.buttonPrimary} onClick={onContinue}>
          Continue to Upload
        </button>
      </div>
    </Card>
  );
}
