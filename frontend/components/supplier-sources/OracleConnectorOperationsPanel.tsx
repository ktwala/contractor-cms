'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { PageHeader } from '@/components/ui/page-header';
import {
  SUPPLIER_SYNCHRONIZATION_LABELS,
  SUPPLIER_SYNCHRONIZATION_NARRATIVE,
} from '@/lib/supplier-synchronization-labels';
import { SupplierSyncGovernanceTab } from './supplier-sync/SupplierSyncGovernanceTab';
import { SupplierSyncHistoryTab } from './supplier-sync/SupplierSyncHistoryTab';
import { SupplierSyncOverviewTab } from './supplier-sync/SupplierSyncOverviewTab';
import { SupplierSyncTabNav } from './supplier-sync/SupplierSyncTabNav';
import { SupplierSyncTabErrorBoundary } from './supplier-sync/SupplierSyncTabErrorBoundary';
import type { DashboardPayload, SupplierSyncTabId } from './supplier-sync/types';
import { normalizeSupplierSyncDashboard } from './supplier-sync/types';
import { useOperationalTrustChanged } from '@/lib/operational-trust-events';

export default function OracleConnectorOperationsPanel() {
  const { can, canAny, user } = useAuth();
  const canSyncSuppliers = can(PERMISSIONS.SUPPLIERS.SYNC);
  const canGovernanceScanSuppliers = can(PERMISSIONS.SUPPLIERS.GOVERNANCE_SCAN);
  const canOpenApprovalsQueue = canAny([
    PERMISSIONS.SUPPLIERS.APPROVE,
    PERMISSIONS.SUPPLIERS.SUSPEND,
  ]);
  const canAssignPortalMembership = can(PERMISSIONS.SUPPLIERS.APPROVE);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SupplierSyncTabId>('overview');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const data = await api.getOracleConnectorDashboard();
      setDashboard(normalizeSupplierSyncDashboard((data ?? {}) as DashboardPayload));
    } catch {
      setLoadError(SUPPLIER_SYNCHRONIZATION_NARRATIVE.loadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useOperationalTrustChanged(() => {
    void load();
  });

  const runAssessment = async () => {
    try {
      setDetecting(true);
      setActionError('');
      await api.detectOracleSourceDrift();
      await load();
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string }; status?: number } })
        ?.response?.data?.message;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409 && typeof apiMessage === 'string') {
        if (apiMessage.toLowerCase().includes('already up to date')) {
          setActionError(SUPPLIER_SYNCHRONIZATION_NARRATIVE.assessmentAlreadyCurrent);
        } else if (apiMessage.toLowerCase().includes('synchronization must complete')) {
          setActionError(SUPPLIER_SYNCHRONIZATION_NARRATIVE.synchronizationRequiredForAssessment);
        } else {
          setActionError(apiMessage);
        }
      } else {
        setActionError(SUPPLIER_SYNCHRONIZATION_NARRATIVE.assessmentFailed);
      }
    } finally {
      setDetecting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">{SUPPLIER_SYNCHRONIZATION_NARRATIVE.loading}</p>;
  }

  if (loadError && !dashboard) {
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
        title={SUPPLIER_SYNCHRONIZATION_LABELS.pageTitle}
        description={SUPPLIER_SYNCHRONIZATION_NARRATIVE.pageDescription}
        onRefresh={load}
        refreshing={loading}
      />

      {actionError ? (
        <p
          className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      <SupplierSyncTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' && (
        <SupplierSyncTabErrorBoundary tabLabel="Overview">
          <SupplierSyncOverviewTab
            dashboard={dashboard}
            canSync={canSyncSuppliers}
            onRefresh={load}
            onNavigateTab={setActiveTab}
          />
        </SupplierSyncTabErrorBoundary>
      )}

      {activeTab === 'history' && (
        <SupplierSyncTabErrorBoundary tabLabel="Snapshot History">
          <SupplierSyncHistoryTab dashboard={dashboard} />
        </SupplierSyncTabErrorBoundary>
      )}

      {activeTab === 'governance' && (
        <SupplierSyncTabErrorBoundary tabLabel="Governance">
          <SupplierSyncGovernanceTab
            dashboard={dashboard}
            canSync={canSyncSuppliers}
            canRunAssessment={
              canGovernanceScanSuppliers &&
              (dashboard.supplierSyncAssessment?.canRunAssessment ?? false)
            }
            detecting={detecting}
            onAssess={runAssessment}
            canOpenApprovalsQueue={canOpenApprovalsQueue}
            canAssignPortalMembership={canAssignPortalMembership}
            tenantAuthority={user?.tenantAuthority}
          />
        </SupplierSyncTabErrorBoundary>
      )}
    </div>
  );
}