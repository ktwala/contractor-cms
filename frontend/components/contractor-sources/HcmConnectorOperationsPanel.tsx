'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { PageHeader } from '@/components/ui/page-header';
import {
  EXTERNAL_WORKFORCE_LABELS,
  resolveWorkforceDiscoveryMetrics,
  WORKFORCE_IMPORT_NARRATIVE,
} from '@/lib/external-workforce-labels';
import { WorkforceImportCutoverTab } from './workforce-import/WorkforceImportCutoverTab';
import { WorkforceImportReconciliationTab } from './workforce-import/WorkforceImportReconciliationTab';
import { WorkforceImportGovernanceTab } from './workforce-import/WorkforceImportGovernanceTab';
import { WorkforceImportHistoryTab } from './workforce-import/WorkforceImportHistoryTab';
import { WorkforceImportOverviewTab } from './workforce-import/WorkforceImportOverviewTab';
import { WorkforceImportTabNav } from './workforce-import/WorkforceImportTabNav';
import {
  sortDriftRows,
  type DashboardPayload,
  type DriftRow,
  type RemediationRow,
  type WorkforceImportTabId,
} from './workforce-import/types';
import { useOperationalTrustChanged } from '@/lib/operational-trust-events';

export default function HcmConnectorOperationsPanel() {
  const { can } = useAuth();
  const canBootstrap = can(PERMISSIONS.CONTRACTORS.BOOTSTRAP);
  const canGovernanceScan = can(PERMISSIONS.CONTRACTORS.GOVERNANCE_SCAN);
  const canCutover = can(PERMISSIONS.WORKFORCE.CUTOVER_MANAGE);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [driftRows, setDriftRows] = useState<DriftRow[]>([]);
  const [remediationRows, setRemediationRows] = useState<RemediationRow[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkforceImportTabId>('overview');
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftRefreshKey, setDriftRefreshKey] = useState(0);
  const [hcmComparisonAnchorsPresent, setHcmComparisonAnchorsPresent] = useState(false);

  const discoveryMetricLabels = resolveWorkforceDiscoveryMetrics(hcmComparisonAnchorsPresent);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [data, remediations] = await Promise.all([
        api.getOracleHcmConnectorDashboard(),
        api.listContractorGovernanceRemediation({ page: 1, limit: 15 }),
      ]);
      setDashboard(data as DashboardPayload);
      setRemediationRows(remediations.data ?? []);
      setDriftRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      if (
        typeof apiMessage === 'string' &&
        apiMessage.toLowerCase().includes('organization context')
      ) {
        setLoadError(WORKFORCE_IMPORT_NARRATIVE.orgContextRequired);
      } else {
        setLoadError(
          apiMessage
            ? `${WORKFORCE_IMPORT_NARRATIVE.loadFailed}: ${apiMessage}`
            : WORKFORCE_IMPORT_NARRATIVE.loadFailed,
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchDrifts() {
      setDriftLoading(true);
      try {
        const drifts = await api.listOracleHcmSourceDrift({
          page: 1,
          limit: 15,
          operationalOnly: true,
        });
        if (!cancelled) {
          setDriftRows(sortDriftRows(drifts.data ?? []));
        }
      } catch {
        // preserve existing rows on error
      } finally {
        if (!cancelled) setDriftLoading(false);
      }
    }
    fetchDrifts();
    return () => {
      cancelled = true;
    };
  }, [driftRefreshKey]);

  const runAssessment = async () => {
    try {
      setDetecting(true);
      setActionError('');
      await api.detectOracleHcmSourceDrift();
      await load();
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string }; status?: number } })
        ?.response?.data?.message;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409 && typeof apiMessage === 'string') {
        if (apiMessage.toLowerCase().includes('already up to date')) {
          setActionError(WORKFORCE_IMPORT_NARRATIVE.assessmentAlreadyCurrent);
        } else if (apiMessage.toLowerCase().includes('discovery must complete')) {
          setActionError(WORKFORCE_IMPORT_NARRATIVE.discoveryRequiredForAssessment);
        } else {
          setActionError(apiMessage);
        }
      } else {
        setActionError(WORKFORCE_IMPORT_NARRATIVE.assessmentFailed);
      }
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api
      .getDemoConfig()
      .then((config) => {
        if (!cancelled) {
          setHcmComparisonAnchorsPresent(config.hcmComparisonAnchorsPresent === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHcmComparisonAnchorsPresent(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useOperationalTrustChanged(() => {
    setDriftRefreshKey((k) => k + 1);
    void load();
  });

  if (loading) {
    return <p className="text-sm text-gray-500">{WORKFORCE_IMPORT_NARRATIVE.loading}</p>;
  }

  if (loadError) {
    return (
      <p className="text-sm text-amber-700" role="alert">
        {loadError}
      </p>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={EXTERNAL_WORKFORCE_LABELS.workforceImport}
        description={WORKFORCE_IMPORT_NARRATIVE.pageDescription}
        onRefresh={load}
        refreshing={loading}
      />

      <WorkforceImportTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {actionError ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2" role="alert">
          {actionError}
        </p>
      ) : null}

      {activeTab === 'overview' && (
        <WorkforceImportOverviewTab
          dashboard={dashboard}
          canBootstrap={canBootstrap}
          onRefresh={load}
          onNavigateTab={setActiveTab}
          metricLabels={discoveryMetricLabels}
        />
      )}

      {activeTab === 'history' && (
        <WorkforceImportHistoryTab dashboard={dashboard} metricLabels={discoveryMetricLabels} />
      )}

      {activeTab === 'governance' && (
        <WorkforceImportGovernanceTab
          dashboard={dashboard}
          driftRows={driftRows}
          driftLoading={driftLoading}
          remediationRows={remediationRows}
          canRunAssessment={
            canGovernanceScan && (dashboard.workforceAssessment?.canRunAssessment ?? false)
          }
          detecting={detecting}
          onAssess={runAssessment}
        />
      )}

      {activeTab === 'reconciliation' && (
        <WorkforceImportReconciliationTab dashboard={dashboard} />
      )}

      {activeTab === 'cutover' && (
        <WorkforceImportCutoverTab
          dashboard={dashboard}
          canCutover={canCutover}
          onCutoverChanged={() => {
            setDriftRefreshKey((k) => k + 1);
            load();
          }}
          driftRefreshKey={driftRefreshKey}
        />
      )}
    </div>
  );
}
