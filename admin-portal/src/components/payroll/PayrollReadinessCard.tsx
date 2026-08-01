import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import * as styles from '../../styles/common';
import { Card, CardHeader, Banner } from '../../ui/layout';

interface ReadinessData {
  payGroupId: string;
  payGroupCode: string;
  countryCode: string;
  currencyCode: string;
  frequency: string;
  readinessPercent: number;
  workforceImported: boolean;
  payrollSupplementalReady: boolean;
  openingBalancesRequired: boolean;
  openingBalancesLoaded: boolean;
  periodsGenerated: boolean;
  eligibleEmployeeCount: number;
  missingBankCount: number;
  missingTaxIdentityCount: number;
  missingTaxNumberCount: number;
  missingCompensationCount: number;
  missingEligibilityCount: number;
  canCreatePayrun: boolean;
  blockingReasons: { code: string; message: string }[];
  nextRecommendedAction: string;
  statutoryBootstrap?: {
    asOf: string;
    countryCode: string;
    packRegistryReady: boolean;
    payeTaxTableReady: boolean;
    statutoryConfigsReady: boolean;
    snapshotEngineReady: boolean;
    operatorBootstrapComplete: boolean;
  };
}

interface PayGroup {
  id: string;
  name: string;
  code: string;
  country: string;
}

const ACTION_ROUTES: Record<string, { label: string; path: string }> = {
  FIX_WORKFORCE: { label: 'Go to Workforce Import', path: '/enterprise/data-imports' },
  IMPORT_PAYROLL_SUPPLEMENTAL: { label: 'Import Payroll Supplemental', path: '/enterprise/data-imports/payroll-supplemental' },
  IMPORT_OPENING_BALANCES: { label: 'Import Opening Balances', path: '/enterprise/data-imports/payroll-opening-balances' },
  GENERATE_PERIODS: { label: 'Generate Periods', path: '/payroll/calendars' },
  FIX_PAYROLL_ELIGIBILITY: { label: 'Fix Payroll Eligibility', path: '/enterprise/data-imports/payroll-supplemental' },
  STATUTORY_BOOTSTRAP: { label: 'Statutory bootstrap & snapshot inputs', path: '/admin/statutory-config' },
  CREATE_PAYRUN: { label: 'Create Payrun', path: '/payroll/payruns/new' },
};

function CheckRow({ label, ok, warning, detail }: { label: string; ok: boolean; warning?: boolean; detail?: string }) {
  const icon = ok ? '✅' : warning ? '⚠️' : '❌';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13 }}>
      <span style={{ fontSize: 15, width: 22, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, color: ok ? styles.colors.text : warning ? '#d97706' : '#dc2626', fontWeight: ok ? 400 : 500 }}>
        {label}
      </span>
      {detail && <span style={{ fontSize: 12, color: styles.colors.textMuted }}>{detail}</span>}
    </div>
  );
}

export default function PayrollReadinessCard() {
  const navigate = useNavigate();
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [selectedPgId, setSelectedPgId] = useState('');
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/pay-groups?limit=200');
        const items = res.data?.items ?? res.data ?? [];
        const list: PayGroup[] = Array.isArray(items) ? items : [];
        setPayGroups(list);
        if (list.length > 0) setSelectedPgId(list[0].id);
      } catch {
        setError('Failed to load pay groups');
      }
    })();
  }, []);

  const loadReadiness = useCallback(async (pgId: string) => {
    if (!pgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/payroll/readiness/pay-groups/${pgId}`);
      setReadiness(res.data);
    } catch {
      setError('Unable to load payroll readiness right now.');
      setReadiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPgId) loadReadiness(selectedPgId);
  }, [selectedPgId, loadReadiness]);

  if (payGroups.length === 0 && !error) {
    return (
      <Card>
        <CardHeader title="Payroll Readiness" />
        <div style={{ padding: '16px 20px', fontSize: 13, color: styles.colors.textMuted }}>
          No pay groups found. Create a pay group before checking payroll readiness.
        </div>
      </Card>
    );
  }

  const action = readiness ? ACTION_ROUTES[readiness.nextRecommendedAction] : null;
  const pct = readiness?.readinessPercent ?? 0;
  const pctColor = pct === 100 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626';

  return (
    <Card>
      <CardHeader
        title="Payroll Readiness"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {payGroups.length > 1 && (
              <select
                value={selectedPgId}
                onChange={(e) => setSelectedPgId(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 12, background: '#fff' }}
              >
                {payGroups.map((pg) => (
                  <option key={pg.id} value={pg.id}>{pg.name} ({pg.code})</option>
                ))}
              </select>
            )}
            <button style={{ ...styles.buttonSecondary, padding: '4px 10px', fontSize: 11 }} onClick={() => loadReadiness(selectedPgId)}>Refresh</button>
          </div>
        }
      />
      <div style={{ padding: '0 20px 20px' }}>
        {error && (
          <Banner variant="error">
            {error}
            <button style={{ ...styles.buttonSecondary, marginLeft: 12, padding: '2px 10px', fontSize: 11 }} onClick={() => loadReadiness(selectedPgId)}>Retry</button>
          </Banner>
        )}

        {loading && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={styles.loadingSpinner} />
            <style>{styles.spinKeyframes}</style>
          </div>
        )}

        {!loading && readiness && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Left: Checklist */}
            <div>
              <div style={{ fontSize: 11, color: styles.colors.textMuted, marginBottom: 8, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                {readiness.payGroupCode} &middot; {readiness.countryCode}
              </div>
              <CheckRow label="Workforce imported" ok={readiness.workforceImported} />
              <CheckRow label="Payroll supplemental loaded" ok={readiness.payrollSupplementalReady} />
              <CheckRow
                label="Opening balances loaded"
                ok={readiness.openingBalancesLoaded}
                warning={!readiness.openingBalancesRequired && !readiness.openingBalancesLoaded}
                detail={!readiness.openingBalancesRequired ? 'optional' : undefined}
              />
              <CheckRow label="Periods generated" ok={readiness.periodsGenerated} />
              {readiness.statutoryBootstrap && (
                <>
                  <CheckRow
                    label="Compute pack + PAYE (snapshot engine)"
                    ok={readiness.statutoryBootstrap.snapshotEngineReady}
                    detail={`as of ${readiness.statutoryBootstrap.asOf}`}
                  />
                  {readiness.countryCode === 'ZA' && (
                    <CheckRow
                      label="ZA statutory configs (UIF, SDL, MTC)"
                      ok={readiness.statutoryBootstrap.statutoryConfigsReady}
                    />
                  )}
                </>
              )}
              <CheckRow
                label="Eligible employees found"
                ok={readiness.eligibleEmployeeCount > 0}
                detail={String(readiness.eligibleEmployeeCount)}
              />
              <CheckRow
                label="Bank accounts complete"
                ok={readiness.missingBankCount === 0}
                warning={readiness.missingBankCount > 0 && readiness.missingBankCount < readiness.eligibleEmployeeCount}
                detail={readiness.missingBankCount > 0 ? `${readiness.missingBankCount} missing` : undefined}
              />
              <CheckRow
                label="Tax identity"
                ok={readiness.missingTaxIdentityCount === 0}
                warning={readiness.missingTaxIdentityCount > 0 && readiness.missingTaxIdentityCount < readiness.eligibleEmployeeCount}
                detail={readiness.missingTaxIdentityCount > 0 ? `${readiness.missingTaxIdentityCount} missing` : undefined}
              />
              <CheckRow
                label="Tax numbers"
                ok={readiness.missingTaxNumberCount === 0}
                warning={readiness.missingTaxNumberCount > 0 && readiness.missingTaxNumberCount < readiness.eligibleEmployeeCount}
                detail={readiness.missingTaxNumberCount > 0 ? `${readiness.missingTaxNumberCount} missing` : undefined}
              />
            </div>

            {/* Right: Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: pctColor }}>{pct}%</div>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Readiness</div>
              </div>

              {readiness.blockingReasons.length > 0 && (
                <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Blocked</div>
                  {readiness.blockingReasons.map((r) => (
                    <div key={r.code} style={{ marginTop: 2 }}>{r.message}</div>
                  ))}
                </div>
              )}

              {readiness.canCreatePayrun && (
                <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: '#166534', fontWeight: 500, textAlign: 'center' }}>
                  This pay group is ready for payroll.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
                {action && (
                  <button
                    style={{
                      ...(readiness.canCreatePayrun ? styles.buttonPrimary : { ...styles.buttonPrimary, background: '#d97706' }),
                      width: '100%',
                    }}
                    onClick={() => navigate(action.path)}
                  >
                    {action.label}
                  </button>
                )}
                <button
                  style={{ ...styles.buttonSecondary, width: '100%', fontSize: 12 }}
                  onClick={() => navigate('/payroll/calendars')}
                >
                  View Calendars
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
