'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { unwrapSupplierPortalDashboard } from '@/lib/supplier-portal-response';
import { useSupplierPortalGate } from '@/hooks/use-supplier-portal-gate';
import CapabilityOverview from './CapabilityOverview';
import SupplierPortalQuickActions from './SupplierPortalQuickActions';
import { isSupplierPortalUser } from '@/lib/supplier-portal-modules';
import { isHcmLinkedResponsibleManagerView } from '@/lib/business-responsible-manager';

export default function PermissionAwareDashboard() {
  const { can, user } = useAuth();
  const portalUser = isSupplierPortalUser(can);
  const businessSponsor = isHcmLinkedResponsibleManagerView(user, can);
  const { ready, supplierLinked, guardApiCall } = useSupplierPortalGate();
  const [supplierCompanyName, setSupplierCompanyName] = useState<string | null>(null);

  const loadSupplierCompanyName = useCallback(async () => {
    if (!portalUser || !guardApiCall(false)) {
      setSupplierCompanyName(null);
      return;
    }
    try {
      const res = await supplierPortalApi.getDashboard();
      const dashboard = unwrapSupplierPortalDashboard(res);
      const name = dashboard?.profile.display_name?.trim();
      setSupplierCompanyName(name || null);
    } catch {
      setSupplierCompanyName(null);
    }
  }, [portalUser, guardApiCall]);

  useEffect(() => {
    if (portalUser && ready && supplierLinked) {
      loadSupplierCompanyName();
    }
  }, [portalUser, ready, supplierLinked, loadSupplierCompanyName]);

  const heading = businessSponsor
    ? 'Sponsor overview'
    : portalUser
      ? supplierCompanyName
        ? `Welcome, ${supplierCompanyName}.`
        : user?.firstName
          ? `Welcome, ${user.firstName}.`
          : 'Welcome.'
      : EXTERNAL_WORKFORCE_LABELS.overview;

  const subtitle = businessSponsor
    ? 'Accountability view for external workers and engagements you sponsor.'
    : portalUser
      ? "Here's what requires your attention today."
      : user?.firstName
        ? `Welcome back, ${user.firstName}. Here's what requires your attention today.`
        : "Here's what requires your attention today.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>

      <CapabilityOverview />

      {portalUser && <SupplierPortalQuickActions />}
    </div>
  );
}
