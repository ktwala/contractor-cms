import { useCallback, useState } from 'react';
import { Page, Card, CardHeader, Banner } from '../../ui/layout';
import * as styles from '../../styles/common';
import { useAccess } from '../../hooks/useAccess';
import { P } from '../../constants/permissions';
import { runSimpleCtcOptimiser } from './api';
import type {
  RunSimpleCtcOptimiserRequest,
  SimpleCtcOptimiserResponse,
  SimpleCtcRecommendation,
  OutcomeStatus,
  MedicalFundingModel,
  DisposableIncomeBreakdown,
} from './api';

type ResultViewMode = 'NET_PAY' | 'DISPOSABLE';

const PRESETS: Array<{ name: string } & RunSimpleCtcOptimiserRequest> = [
  {
    name: 'Executive balanced',
    countryCode: 'ZA',
    taxYear: '2025/2026',
    payFrequency: 'monthly',
    optimisationMode: 'TARGET_NET',
    packageInput: { ctc: 120000, targetNet: 80000, medicalAidAmount: 15000, beneficiaries: 2, medicalFundingModel: 'EMPLOYER_FUNDED' },
    policyInput: { allowTravelAllowance: true, requireRetirementFund: true, minimumRetirementAmount: 5000 },
    advancedConstraints: { minBasicPercent: 55, maxAllowancePercent: 35, maxTravelPercent: 25, maxReimbursiveAmount: 5000 },
  },
  {
    name: 'Cash maximiser',
    countryCode: 'ZA',
    taxYear: '2025/2026',
    payFrequency: 'monthly',
    optimisationMode: 'MAX_NET',
    packageInput: { ctc: 80000, medicalAidAmount: 8000, beneficiaries: 1, medicalFundingModel: 'EMPLOYER_FUNDED' },
    policyInput: { allowTravelAllowance: true, requireRetirementFund: false },
    advancedConstraints: { minBasicPercent: 50, maxAllowancePercent: 40, maxTravelPercent: 30, maxReimbursiveAmount: 3000 },
  },
  {
    name: 'Retirement focused',
    countryCode: 'ZA',
    taxYear: '2025/2026',
    payFrequency: 'monthly',
    optimisationMode: 'BALANCED',
    packageInput: { ctc: 100000, medicalAidAmount: 12000, beneficiaries: 2, medicalFundingModel: 'EMPLOYER_FUNDED' },
    policyInput: { allowTravelAllowance: false, requireRetirementFund: true, minimumRetirementAmount: 10000 },
  },
  {
    name: 'Family medical',
    countryCode: 'ZA',
    taxYear: '2025/2026',
    payFrequency: 'monthly',
    optimisationMode: 'TARGET_NET',
    packageInput: { ctc: 90000, targetNet: 55000, medicalAidAmount: 20000, beneficiaries: 4, medicalFundingModel: 'EMPLOYER_FUNDED' },
    policyInput: { allowTravelAllowance: true, requireRetirementFund: true, minimumRetirementAmount: 5000 },
    advancedConstraints: { maxTravelPercent: 15, requireMedicalAsEmployerContribution: true },
  },
];

const fmt = (n: number | null | undefined) => {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(n);
};

const GOAL_LABELS: Record<string, { label: string; desc: string }> = {
  MAX_NET: { label: 'Maximise Take-Home', desc: 'Highest possible net pay' },
  TARGET_NET: { label: 'Hit Target Net', desc: 'Get as close as possible to a target' },
  BALANCED: { label: 'Balanced', desc: 'Good mix of net pay and retirement' },
};

const STATUS_DISPLAY: Record<OutcomeStatus, { label: string; color: string; bg: string }> = {
  ON_TARGET: { label: 'On Target', color: '#059669', bg: '#f0fdf4' },
  CLOSE: { label: 'Close', color: '#d97706', bg: '#fffbeb' },
  BELOW_TARGET: { label: 'Below Target', color: '#dc2626', bg: '#fef2f2' },
  UNREACHABLE_UNDER_RULES: { label: 'Unreachable under current rules', color: '#dc2626', bg: '#fef2f2' },
};

const LABEL_COLORS: Record<string, { border: string; bg: string }> = {
  Recommended: { border: '#2563eb', bg: '#eff6ff' },
  'Higher Take-Home': { border: '#059669', bg: '#f0fdf4' },
  'Stronger Retirement': { border: '#7c3aed', bg: '#f5f3ff' },
  Conservative: { border: '#64748b', bg: '#f8fafc' },
};

const inputField = (label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</label>
    <input
      {...props}
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        border: '1px solid #e2e8f0',
        fontSize: 14,
        outline: 'none',
      }}
    />
  </div>
);

export default function CtcOptimiserPage() {
  const { can } = useAccess();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimpleCtcOptimiserResponse | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [resultView, setResultView] = useState<ResultViewMode>('NET_PAY');

  const [form, setForm] = useState<RunSimpleCtcOptimiserRequest>({
    countryCode: 'ZA',
    taxYear: '2025/2026',
    payFrequency: 'monthly',
    optimisationMode: 'TARGET_NET',
    packageInput: { ctc: 120000, targetNet: 80000, medicalAidAmount: 15000, beneficiaries: 2, medicalFundingModel: 'EMPLOYER_FUNDED' as MedicalFundingModel },
    policyInput: { allowTravelAllowance: true, requireRetirementFund: true, minimumRetirementAmount: 5000 },
    advancedConstraints: { minBasicPercent: 55, maxAllowancePercent: 35, maxTravelPercent: 25, maxReimbursiveAmount: 5000 },
  });

  const updatePackage = useCallback(
    (key: string, value: number | string) => {
      setForm((prev) => ({
        ...prev,
        packageInput: { ...prev.packageInput, [key]: value },
      }));
    },
    [],
  );

  const updatePolicy = useCallback(
    (key: string, value: boolean | number) => {
      setForm((prev) => ({
        ...prev,
        policyInput: { ...prev.policyInput, [key]: value },
      }));
    },
    [],
  );

  const updateAdvanced = useCallback(
    (key: string, value: number | boolean) => {
      setForm((prev) => ({
        ...prev,
        advancedConstraints: { ...prev.advancedConstraints, [key]: value },
      }));
    },
    [],
  );

  const handleRun = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await runSimpleCtcOptimiser(form);
      setResult(data);
      setResultView(form.optimisationMode === 'BALANCED' ? 'DISPOSABLE' : 'NET_PAY');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Optimisation failed');
    } finally {
      setLoading(false);
    }
  }, [form]);

  const loadPreset = useCallback((preset: (typeof PRESETS)[number]) => {
    const { name: _, ...values } = preset;
    setForm(values);
    setResult(null);
    setError(null);
  }, []);

  if (!can(P.CTC_OPTIMISER_VIEW)) {
    return (
      <Page title="CTC Optimiser">
        <Banner variant="error">
          You do not have permission to access the CTC Optimiser. Required: {P.CTC_OPTIMISER_VIEW}
        </Banner>
      </Page>
    );
  }

  return (
    <Page
      title="CTC Optimiser"
      subtitle="Enter your package total and desired outcome. The optimiser will suggest the salary structure that gets closest using the live payroll engine and your current policy rules."
    >
      {error && <Banner variant="error">{error}</Banner>}

      {/* Step 1: Goal Selection */}
      <Card>
        <CardHeader title="Step 1 — Optimisation Goal" />
        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 12 }}>
          {(['MAX_NET', 'TARGET_NET', 'BALANCED'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setForm((p) => ({ ...p, optimisationMode: mode }))}
              style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: 8,
                border: form.optimisationMode === mode ? '2px solid #2563eb' : '1px solid #e2e8f0',
                background: form.optimisationMode === mode ? '#eff6ff' : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: form.optimisationMode === mode ? '#1d4ed8' : '#334155' }}>
                {GOAL_LABELS[mode].label}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {GOAL_LABELS[mode].desc}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Quick Presets */}
      <Card>
        <CardHeader title="Quick Presets" />
        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => loadPreset(preset)}
              style={{ ...styles.buttonSecondary, fontSize: 12, padding: '6px 14px' }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </Card>

      {/* Step 2: Core Package Inputs */}
      <Card>
        <CardHeader title="Step 2 — Package Inputs" />
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {inputField('Total CTC (monthly)', {
              type: 'number',
              value: form.packageInput.ctc,
              onChange: (e) => updatePackage('ctc', Number(e.target.value)),
            })}
            {form.optimisationMode === 'TARGET_NET' &&
              inputField('Target Net Pay', {
                type: 'number',
                value: form.packageInput.targetNet ?? 0,
                onChange: (e) => updatePackage('targetNet', Number(e.target.value)),
              })}
            {inputField('Medical Aid (monthly)', {
              type: 'number',
              value: form.packageInput.medicalAidAmount,
              onChange: (e) => updatePackage('medicalAidAmount', Number(e.target.value)),
            })}
            {inputField('Beneficiaries', {
              type: 'number',
              value: form.packageInput.beneficiaries,
              onChange: (e) => updatePackage('beneficiaries', Number(e.target.value)),
            })}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Medical Funding</label>
              <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                {(['EMPLOYER_FUNDED', 'EMPLOYEE_PAID'] as const).map((model) => (
                  <label key={model} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="medicalFundingModel"
                      checked={(form.packageInput.medicalFundingModel ?? 'EMPLOYER_FUNDED') === model}
                      onChange={() => updatePackage('medicalFundingModel', model as any)}
                    />
                    {model === 'EMPLOYER_FUNDED' ? 'Employer-funded (within CTC)' : 'Employee-paid (deducted from net)'}
                  </label>
                ))}
              </div>
            </div>
            {form.policyInput.requireRetirementFund &&
              inputField('Minimum Retirement Amount', {
                type: 'number',
                value: form.policyInput.minimumRetirementAmount ?? 0,
                onChange: (e) => updatePolicy('minimumRetirementAmount', Number(e.target.value)),
              })}
          </div>

          {/* Policy toggles */}
          <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.policyInput.allowTravelAllowance}
                onChange={(e) => updatePolicy('allowTravelAllowance', e.target.checked)}
              />
              Allow travel allowance
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.policyInput.requireRetirementFund}
                onChange={(e) => updatePolicy('requireRetirementFund', e.target.checked)}
              />
              Require retirement fund
            </label>
          </div>

          {/* Advanced Constraints Accordion */}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: '#2563eb',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>
                ▸
              </span>
              Advanced Constraints
            </button>
            {advancedOpen && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                {inputField('Min Basic %', {
                  type: 'number',
                  value: form.advancedConstraints?.minBasicPercent ?? 55,
                  onChange: (e) => updateAdvanced('minBasicPercent', Number(e.target.value)),
                })}
                {inputField('Max Allowance %', {
                  type: 'number',
                  value: form.advancedConstraints?.maxAllowancePercent ?? 35,
                  onChange: (e) => updateAdvanced('maxAllowancePercent', Number(e.target.value)),
                })}
                {form.policyInput.allowTravelAllowance &&
                  inputField('Max Travel %', {
                    type: 'number',
                    value: form.advancedConstraints?.maxTravelPercent ?? 25,
                    onChange: (e) => updateAdvanced('maxTravelPercent', Number(e.target.value)),
                  })}
                {form.policyInput.allowTravelAllowance &&
                  inputField('Max Reimbursive', {
                    type: 'number',
                    value: form.advancedConstraints?.maxReimbursiveAmount ?? 5000,
                    onChange: (e) => updateAdvanced('maxReimbursiveAmount', Number(e.target.value)),
                  })}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', gridColumn: '1 / -1' }}>
                  <input
                    type="checkbox"
                    checked={form.advancedConstraints?.requireMedicalAsEmployerContribution ?? true}
                    onChange={(e) => updateAdvanced('requireMedicalAsEmployerContribution', e.target.checked)}
                  />
                  Require medical as employer contribution
                </label>
              </div>
            )}
          </div>

          {/* CTA */}
          <div style={{ marginTop: 20 }}>
            <button
              style={{ ...styles.buttonPrimary, padding: '12px 32px', fontSize: 15 }}
              onClick={handleRun}
              disabled={loading || !can(P.CTC_OPTIMISER_RUN)}
            >
              {loading ? 'Optimising...' : 'Optimise Package'}
            </button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Banner */}
          <SummaryBanner summary={result.summary} resultView={resultView} />

          {/* Suggestions for unreachable/below target */}
          {result.suggestions.length > 0 && (
            <div style={{
              padding: '14px 20px',
              borderRadius: 8,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: 13,
              color: '#92400e',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Suggestions</div>
              {result.suggestions.map((s, i) => (
                <div key={i} style={{ marginBottom: 2 }}>&bull; {s}</div>
              ))}
            </div>
          )}

          {/* Recommendation Cards */}
          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader
                title="Step 3 — Recommendations"
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      display: 'inline-flex',
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid #e2e8f0',
                    }}>
                      {([
                        { key: 'NET_PAY' as ResultViewMode, label: 'View by Net Pay' },
                        { key: 'DISPOSABLE' as ResultViewMode, label: 'View by Real Disposable' },
                      ]).map((v) => (
                        <button
                          key={v.key}
                          onClick={() => setResultView(v.key)}
                          style={{
                            padding: '4px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            background: resultView === v.key ? '#2563eb' : '#fff',
                            color: resultView === v.key ? '#fff' : '#64748b',
                          }}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {result.recommendations.length} option{result.recommendations.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                }
              />
              {result.summary.optimisationMode === 'BALANCED' && resultView === 'DISPOSABLE' && (
                <div style={{ padding: '0 24px 8px', fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                  Balanced mode defaults to real disposable value, which accounts for employer-funded benefits that replace personal spending.
                </div>
              )}
              <div
                style={{
                  padding: '0 24px 24px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 16,
                }}
              >
                {result.recommendations.map((rec, idx) => (
                  <RecommendationCard
                    key={idx}
                    rec={rec}
                    medicalFundingModel={result.summary.medicalFundingModel}
                    resultView={resultView}
                  />
                ))}
              </div>
            </Card>
          )}

          {result.recommendations.length === 0 && (
            <Banner variant="warning">
              No valid package structure could meet the current constraints.
              Try lowering the retirement minimum, allowing travel allowance, or reducing the target net.
            </Banner>
          )}
        </>
      )}
    </Page>
  );
}

function SummaryBanner({ summary, resultView }: { summary: SimpleCtcOptimiserResponse['summary']; resultView: ResultViewMode }) {
  const statusInfo = STATUS_DISPLAY[summary.outcomeStatus];
  const isTargetMode = summary.optimisationMode === 'TARGET_NET' && summary.targetNet != null;
  const hasTdi = summary.trueDisposableIncome != null;

  return (
    <div style={{
      padding: '20px 24px',
      borderRadius: 10,
      background: statusInfo.bg,
      border: `1px solid ${statusInfo.color}22`,
    }}>
      {/* Top row: key metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Net Pay</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: resultView === 'NET_PAY' ? '#059669' : '#334155' }}>{fmt(summary.bestAchievedNet)}</div>
        </div>
        {hasTdi && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>True Disposable</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: resultView === 'DISPOSABLE' ? '#059669' : '#334155' }}>{fmt(summary.trueDisposableIncome)}</div>
          </div>
        )}
        {isTargetMode && (
          <>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Target Net</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1e40af' }}>{fmt(summary.targetNet)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Gap</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: (summary.gapToTarget ?? 0) >= 0 ? '#059669' : '#dc2626' }}>
                {(summary.gapToTarget ?? 0) >= 0 ? '+' : ''}{fmt(summary.gapToTarget)}
              </div>
            </div>
          </>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{
            padding: '6px 14px',
            borderRadius: 999,
            background: statusInfo.color + '18',
            color: statusInfo.color,
            fontWeight: 700,
            fontSize: 12,
          }}>
            {statusInfo.label}
          </div>
        </div>
      </div>

      {/* Second row: medical treatment badge */}
      {summary.medicalAmount > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: summary.medicalFundingModel === 'EMPLOYER_FUNDED' ? '#eff6ff' : '#fef2f2',
            color: summary.medicalFundingModel === 'EMPLOYER_FUNDED' ? '#1d4ed8' : '#dc2626',
            fontWeight: 600,
            fontSize: 11,
          }}>
            Medical {fmt(summary.medicalAmount)} &mdash; {summary.medicalFundingModel === 'EMPLOYER_FUNDED' ? 'Employer-funded' : 'Employee-paid'}
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({
  rec,
  medicalFundingModel,
  resultView,
}: {
  rec: SimpleCtcRecommendation;
  medicalFundingModel?: MedicalFundingModel;
  resultView: ResultViewMode;
}) {
  const labelStyle = LABEL_COLORS[rec.label] ?? LABEL_COLORS.Conservative;
  const hasDisposable = rec.disposableBreakdown != null;
  const primaryValue = resultView === 'DISPOSABLE' && hasDisposable ? rec.trueDisposableIncome : rec.payroll.netPay;
  const primaryLabel = resultView === 'DISPOSABLE' ? 'TRUE DISPOSABLE' : 'NET PAY';
  const primaryColor = '#059669';

  return (
    <div
      style={{
        border: `2px solid ${labelStyle.border}`,
        borderRadius: 12,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        background: labelStyle.bg,
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: labelStyle.border }}>
          {rec.label}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 999,
          background: rec.policyStatus === 'PASS' ? '#f0fdf4' : '#fffbeb',
          color: rec.policyStatus === 'PASS' ? '#16a34a' : '#d97706',
        }}>
          {rec.policyStatus}
        </span>
      </div>

      {/* Key metrics */}
      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{primaryLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: primaryColor }}>{fmt(primaryValue)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>PAYE</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{fmt(rec.payroll.paye)}</div>
        </div>
      </div>

      {/* Disposable Income Breakdown */}
      {hasDisposable && (
        <div style={{ padding: '0 16px 12px', fontSize: 13, background: '#f8fafc', margin: '0 12px', borderRadius: 8, paddingTop: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#334155', fontSize: 12 }}>Disposable Income</div>
          <Row label="Net Pay" value={fmt(rec.payroll.netPay)} bold />
          {rec.disposableBreakdown.employerFundedBenefits > 0 && (
            <Row label="+ Employer-funded medical" value={fmt(rec.disposableBreakdown.employerFundedBenefits)} color="#059669" />
          )}
          {rec.disposableBreakdown.personalObligations > 0 && (
            <Row label="- Personal obligations" value={`-${fmt(rec.disposableBreakdown.personalObligations)}`} color="#dc2626" />
          )}
          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>True Disposable Income</span>
            <span style={{ fontWeight: 700, color: '#059669' }}>{fmt(rec.trueDisposableIncome)}</span>
          </div>
        </div>
      )}

      {/* Package Structure */}
      <div style={{ padding: '0 16px 12px', fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#334155' }}>Package Structure</div>
        <Row label="Basic Salary" value={fmt(rec.breakdown.basicSalary)} />
        <Row label="Travel Allowance" value={fmt(rec.breakdown.travelAllowance)} />
        <Row
          label={medicalFundingModel === 'EMPLOYEE_PAID' ? 'Medical Aid (employee deduction)' : 'Medical Aid (employer-funded)'}
          value={fmt(rec.breakdown.medicalAidEmployerContribution)}
        />
        <Row label="Retirement" value={fmt(rec.breakdown.retirementContribution)} />
        {rec.breakdown.reimbursiveTravelNonTaxable > 0 && (
          <Row label="Reimbursive" value={fmt(rec.breakdown.reimbursiveTravelNonTaxable)} />
        )}
        {rec.breakdown.otherAllowanceTaxable > 0 && (
          <Row label="Other (taxable)" value={fmt(rec.breakdown.otherAllowanceTaxable)} />
        )}
      </div>

      {/* Explanations */}
      {rec.explanations.length > 0 && (
        <div style={{ padding: '0 16px 12px', fontSize: 12, color: '#475569' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Why this option</div>
          {rec.explanations.map((e, i) => (
            <div key={i} style={{ marginBottom: 2 }}>&bull; {e}</div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {rec.warnings.length > 0 && (
        <div style={{ padding: '0 16px 12px', fontSize: 12, color: '#d97706' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Warnings</div>
          {rec.warnings.map((w, i) => (
            <div key={i} style={{ marginBottom: 2 }}>&bull; {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: color ?? '#64748b', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: color ?? undefined }}>{value}</span>
    </div>
  );
}
