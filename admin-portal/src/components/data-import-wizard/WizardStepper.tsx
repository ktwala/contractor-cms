import * as styles from '../../styles/common';
import { ui } from '../../ui/layout';

export type WizardStep =
  | 'SELECT_DATASET'
  | 'DOWNLOAD_TEMPLATE'
  | 'UPLOAD_FILE'
  | 'VALIDATE'
  | 'REVIEW_APPROVE'
  | 'PUBLISH';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'SELECT_DATASET', label: 'Select Dataset' },
  { key: 'DOWNLOAD_TEMPLATE', label: 'Download Template' },
  { key: 'UPLOAD_FILE', label: 'Upload File' },
  { key: 'VALIDATE', label: 'Validate' },
  { key: 'REVIEW_APPROVE', label: 'Review & Approve' },
  { key: 'PUBLISH', label: 'Publish' },
];

export const STEP_ORDER = STEPS.map((s) => s.key);

export default function WizardStepper({
  currentStep,
  completedSteps,
  blockedSteps,
}: {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  blockedSteps: Set<WizardStep>;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
        marginBottom: ui.space.lg,
        padding: '12px 0',
        borderBottom: `1px solid ${styles.colors.borderLight}`,
      }}
    >
      {STEPS.map((step, i) => {
        const isCompleted = completedSteps.has(step.key);
        const isCurrent = step.key === currentStep;
        const isBlocked = blockedSteps.has(step.key);
        const stepIdx = STEP_ORDER.indexOf(step.key);

        return (
          <div
            key={step.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                background: isCompleted
                  ? styles.colors.success
                  : isCurrent
                    ? styles.colors.primary
                    : isBlocked
                      ? styles.colors.border
                      : styles.colors.background,
                color: isCompleted || isCurrent ? 'white' : isBlocked ? styles.colors.textMuted : styles.colors.textSecondary,
              }}
            >
              {isCompleted ? (
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                stepIdx + 1
              )}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: isCurrent ? 700 : 500,
                color: isBlocked
                  ? styles.colors.textMuted
                  : isCurrent
                    ? styles.colors.textPrimary
                    : styles.colors.textSecondary,
              }}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 2,
                  background: isCompleted ? styles.colors.success : styles.colors.borderLight,
                  marginLeft: 4,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
