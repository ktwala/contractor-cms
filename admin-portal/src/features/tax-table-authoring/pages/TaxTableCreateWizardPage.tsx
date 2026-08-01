import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import * as styles from '../../../styles/common';
import { Page } from '../../../ui/layout';
import { ErrorBanner } from '../components/ErrorBanner';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { ContextStep } from '../components/wizard/ContextStep';
import { MethodStep } from '../components/wizard/MethodStep';
import { ReviewStep } from '../components/wizard/ReviewStep';
import { ValidateStep } from '../components/wizard/ValidateStep';
import { PublishStep } from '../components/wizard/PublishStep';
import type { SourceType } from '../types';

export type WizardContext = {
  countryCode: string;
  tableType: string;
  taxYear: string;
  effectiveFrom: string;
  effectiveTo: string;
};

export type WizardState = {
  step: number;
  context: WizardContext;
  method: SourceType | '';
  sourceSelection: {
    templateId?: string;
    sourceAuthoringId?: string;
  };
  draftId: string;
  dirty: boolean;
};

const STEPS = ['Context', 'Method', 'Review & Edit', 'Validate', 'Publish'];

const stepperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  marginBottom: 32,
  padding: '0 4px',
};

function StepIndicator({ index, label, active, completed }: {
  index: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  const circleSize = 32;
  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: index < STEPS.length - 1 ? 1 : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: circleSize,
            height: circleSize,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            background: completed ? '#4f46e5' : active ? '#4f46e5' : '#e2e8f0',
            color: completed || active ? '#fff' : '#64748b',
            transition: 'all 0.2s',
          }}
        >
          {completed ? <Check size={16} /> : index + 1}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: active ? 600 : 500,
            color: active ? '#1e293b' : '#94a3b8',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </div>
      {index < STEPS.length - 1 && (
        <div
          style={{
            flex: 1,
            height: 2,
            background: completed ? '#4f46e5' : '#e2e8f0',
            margin: '0 12px',
            transition: 'background 0.2s',
          }}
        />
      )}
    </div>
  );
}

const SESSION_KEY = 'tta_wizard_state';

function loadPersistedState(): Partial<WizardState> | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function persistState(state: WizardState) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      context: state.context,
      method: state.method,
      sourceSelection: state.sourceSelection,
      draftId: state.draftId,
      step: state.step,
    }));
  } catch { /* storage full or unavailable */ }
}

function clearPersistedState() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export default function TaxTableCreateWizardPage() {
  const navigate = useNavigate();

  const [state, setState] = useState<WizardState>(() => {
    const persisted = loadPersistedState();
    if (persisted?.draftId) {
      return {
        step: Math.max(persisted.step ?? 2, 2),
        context: persisted.context ?? { countryCode: '', tableType: '', taxYear: '', effectiveFrom: '', effectiveTo: '' },
        method: (persisted.method ?? '') as any,
        sourceSelection: persisted.sourceSelection ?? {},
        draftId: persisted.draftId,
        dirty: false,
      };
    }
    return {
      step: 0,
      context: { countryCode: '', tableType: '', taxYear: '', effectiveFrom: '', effectiveTo: '' },
      method: '',
      sourceSelection: {},
      draftId: '',
      dirty: false,
    };
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    persistState(state);
  }, [state.step, state.draftId, state.context, state.method]);

  const { confirmNavigation } = useUnsavedChanges(state.dirty);

  const updateState = useCallback((patch: Partial<WizardState>) => {
    setState((s) => ({ ...s, ...patch, dirty: true }));
  }, []);

  const goBack = () => {
    if (state.step === 0) {
      confirmNavigation(() => {
        clearPersistedState();
        navigate('/admin/payroll/tax-tables');
      });
    } else {
      setState((s) => ({ ...s, step: s.step - 1 }));
    }
  };

  const goNext = () => {
    setState((s) => ({ ...s, step: Math.min(s.step + 1, STEPS.length - 1) }));
  };

  const onDraftCreated = (draftId: string) => {
    setState((s) => ({ ...s, draftId, step: 2, dirty: false }));
  };

  const contextValid =
    !!state.context.countryCode &&
    !!state.context.tableType &&
    !!state.context.taxYear &&
    !!state.context.effectiveFrom;

  const methodValid = !!state.method;

  const canNext = (() => {
    switch (state.step) {
      case 0: return contextValid;
      case 1: return methodValid;
      case 2: return !!state.draftId;
      case 3: return !!state.draftId;
      default: return false;
    }
  })();

  return (
    <Page
      title="Create Tax Table"
      subtitle="Follow the guided workflow to create and publish a tax table"
      actions={
        <button style={styles.buttonSecondary} onClick={goBack}>
          <ArrowLeft size={16} /> {state.step === 0 ? 'Cancel' : 'Back'}
        </button>
      }
    >
      {/* Stepper */}
      <div style={stepperStyle}>
        {STEPS.map((label, i) => (
          <StepIndicator
            key={label}
            index={i}
            label={label}
            active={state.step === i}
            completed={state.step > i}
          />
        ))}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {/* Step content */}
      <div style={{ minHeight: 400 }}>
        {state.step === 0 && (
          <ContextStep
            context={state.context}
            onChange={(ctx) => updateState({ context: ctx })}
          />
        )}
        {state.step === 1 && (
          <MethodStep
            context={state.context}
            method={state.method}
            sourceSelection={state.sourceSelection}
            onChange={(patch) => updateState(patch)}
            onDraftCreated={onDraftCreated}
            setError={setError}
          />
        )}
        {state.step === 2 && state.draftId && (
          <ReviewStep draftId={state.draftId} setError={setError} />
        )}
        {state.step === 3 && state.draftId && (
          <ValidateStep draftId={state.draftId} setError={setError} />
        )}
        {state.step === 4 && state.draftId && (
          <PublishStep
            draftId={state.draftId}
            setError={setError}
            onPublished={() => { clearPersistedState(); navigate('/admin/payroll/tax-tables?tab=published'); }}
          />
        )}
      </div>

      {/* Navigation bar */}
      {state.step < 4 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 32,
            paddingTop: 20,
            borderTop: `1px solid ${styles.colors.border}`,
          }}
        >
          <button style={styles.buttonSecondary} onClick={goBack}>
            <ArrowLeft size={14} /> {state.step === 0 ? 'Cancel' : 'Back'}
          </button>
          {state.step < STEPS.length - 1 && (
            <button
              style={{
                ...styles.buttonPrimary,
                opacity: canNext ? 1 : 0.5,
                pointerEvents: canNext ? 'auto' : 'none',
              }}
              onClick={goNext}
              disabled={!canNext}
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
    </Page>
  );
}
