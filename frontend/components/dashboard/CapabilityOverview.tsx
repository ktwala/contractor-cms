'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { useAuth } from '@/lib/auth-context';
import {
  CAPABILITY_NAV_LABELS,
  EXTERNAL_WORKFORCE_LABELS,
} from '@/lib/external-workforce-labels';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { isSupplierPortalUser } from '@/lib/supplier-portal-modules';
import { isHcmLinkedResponsibleManagerView } from '@/lib/business-responsible-manager';
import { pdpExceptionService } from '@/services/pdp-exception.service';
import { pdpActivationService } from '@/services/pdp-activation.service';
import {
  unwrapSupplierPortalDashboard,
  unwrapSupplierPortalList,
} from '@/lib/supplier-portal-response';

type CapabilityHealth = 'healthy' | 'attention';

type OverviewMetric = {
  label: string;
  value: string;
  href: string;
  tone?: 'default' | 'warning' | 'critical';
};

type OverviewSection = {
  id: string;
  title: string;
  health: CapabilityHealth;
  metrics: OverviewMetric[];
};

function deriveSectionHealth(metrics: OverviewMetric[]): CapabilityHealth {
  if (metrics.some((m) => m.tone === 'warning' || m.tone === 'critical')) {
    return 'attention';
  }
  return 'healthy';
}

function healthLabel(health: CapabilityHealth) {
  return health === 'attention' ? 'Attention' : 'Healthy';
}

function healthBadgeClass(health: CapabilityHealth) {
  return health === 'attention'
    ? 'bg-amber-50 text-amber-800 ring-amber-200'
    : 'bg-emerald-50 text-emerald-800 ring-emerald-200';
}

function toneClass(tone: OverviewMetric['tone']) {
  if (tone === 'critical') return 'text-red-600';
  if (tone === 'warning') return 'text-amber-600';
  return 'text-gray-900';
}

type PortalContractorRow = { workforceState?: string };

async function loadSupplierPortalAttentionSection(options: {
  canReadContractors: boolean;
  canReadTimesheets: boolean;
  canReadInvoices: boolean;
}): Promise<OverviewSection> {
  const metrics: OverviewMetric[] = [];

  const [dashboardRes, contractorsRes, invoicesRes] = await Promise.all([
    supplierPortalApi.getDashboard().catch(() => null),
    options.canReadContractors
      ? supplierPortalApi.getContractors({ page: 1, limit: 200 }).catch(() => null)
      : Promise.resolve(null),
    options.canReadInvoices
      ? supplierPortalApi.getInvoices({ page: 1, limit: 100 }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const dashboard = dashboardRes ? unwrapSupplierPortalDashboard(dashboardRes) : null;
  const contractors = contractorsRes
    ? unwrapSupplierPortalList<PortalContractorRow>(contractorsRes).items
    : [];
  const invoiceItems = invoicesRes
    ? unwrapSupplierPortalList<{ status?: string }>(invoicesRes).items
    : [];

  const awaitingReview = contractors.filter((c) =>
    ['NOMINATED', 'PENDING_APPROVAL'].includes(c.workforceState ?? ''),
  ).length;
  const rejected = contractors.filter((c) => c.workforceState === 'REJECTED').length;
  const pendingTimesheets = dashboard?.timesheets.pending ?? 0;
  const draftInvoices = invoiceItems.filter((i) => i.status === 'DRAFT').length;

  if (options.canReadContractors) {
    metrics.push({
      label: 'Workers awaiting review',
      value: String(awaitingReview),
      href: '/supplier-portal/contractors',
      tone: awaitingReview > 0 ? 'warning' : 'default',
    });
    metrics.push({
      label: 'Rejected nominations',
      value: String(rejected),
      href: '/supplier-portal/contractors',
      tone: rejected > 0 ? 'warning' : 'default',
    });
  }
  if (options.canReadTimesheets) {
    metrics.push({
      label: 'Timesheets awaiting submission',
      value: String(pendingTimesheets),
      href: '/supplier-portal/timesheets',
      tone: pendingTimesheets > 0 ? 'warning' : 'default',
    });
  }
  if (options.canReadInvoices) {
    metrics.push({
      label: 'Invoices awaiting submission',
      value: String(draftInvoices),
      href: '/supplier-portal/invoices',
      tone: draftInvoices > 0 ? 'warning' : 'default',
    });
  }

  if (metrics.length === 0) {
    metrics.push({
      label: 'Status',
      value: 'All caught up',
      href: '/supplier-portal/contractors',
    });
  }

  return {
    id: 'supplierPortal',
    title: "Today's attention",
    health: deriveSectionHealth(metrics),
    metrics,
  };
}

async function loadOperationsAttentionSection(options: {
  canReadSuppliers: boolean;
  canReadSupplierApprovals: boolean;
  canReadContractors: boolean;
  canReadContracts: boolean;
  canReadTimesheets: boolean;
  canReadInvoices: boolean;
  canReadResponsibleManagerTasks: boolean;
  canViewPdpExceptions: boolean;
  canViewPdpActivation: boolean;
}): Promise<OverviewSection> {
  const metrics: OverviewMetric[] = [];

  const [
    approvalsRes,
    reviewRes,
    expiringRes,
    timesheetsRes,
    invoicesRes,
    tasksRes,
    exceptions,
    activation,
  ] = await Promise.all([
    options.canReadSupplierApprovals
      ? api.getSupplierApprovalQueue().catch(() => null)
      : Promise.resolve(null),
    options.canReadContractors
      ? api.getContractorWorkforceReviewQueue().catch(() => null)
      : Promise.resolve(null),
    options.canReadContracts
      ? api.getContracts({ expiresWithinDays: 30, limit: 1 }).catch(() => null)
      : Promise.resolve(null),
    options.canReadTimesheets ? api.getTimesheets().catch(() => null) : Promise.resolve(null),
    options.canReadInvoices ? api.getInvoices().catch(() => null) : Promise.resolve(null),
    options.canReadResponsibleManagerTasks
      ? api.getResponsibleManagerTasks({ status: 'OPEN', limit: 50 }).catch(() => null)
      : Promise.resolve(null),
    options.canViewPdpExceptions
      ? pdpExceptionService.listExceptions('PENDING').catch(() => null)
      : Promise.resolve(null),
    options.canViewPdpActivation
      ? pdpActivationService.listRules().catch(() => null)
      : Promise.resolve(null),
  ]);

  if (options.canReadSupplierApprovals && approvalsRes) {
    const pendingApprovals = (approvalsRes.data ?? []).length;
    metrics.push({
      label: 'Operational trust queue',
      value: String(pendingApprovals),
      href: '/suppliers/approvals',
      tone: pendingApprovals > 0 ? 'warning' : 'default',
    });
  }

  if (options.canReadContractors && reviewRes) {
    const awaitingReview = (reviewRes.data ?? []).length;
    metrics.push({
      label: 'Workers awaiting review',
      value: String(awaitingReview),
      href: '/contractors/workforce-review',
      tone: awaitingReview > 0 ? 'warning' : 'default',
    });
  }

  if (options.canReadContracts && expiringRes) {
    const expiring = expiringRes.total ?? 0;
    metrics.push({
      label: 'Contracts expiring (30 days)',
      value: String(expiring),
      href: '/contracts',
      tone: expiring > 0 ? 'warning' : 'default',
    });
  }

  if (options.canReadTimesheets && timesheetsRes) {
    const pendingTimesheets = (timesheetsRes.data ?? []).filter(
      (t: { status: string }) => t.status === 'SUBMITTED',
    ).length;
    metrics.push({
      label: 'Timesheets awaiting approval',
      value: String(pendingTimesheets),
      href: '/timesheets',
      tone: pendingTimesheets > 0 ? 'warning' : 'default',
    });
  }

  if (options.canReadInvoices && invoicesRes) {
    const outstanding = (invoicesRes.data ?? []).filter(
      (i: { status: string }) => i.status === 'SUBMITTED' || i.status === 'APPROVED',
    ).length;
    metrics.push({
      label: 'Invoices awaiting payment',
      value: String(outstanding),
      href: '/invoices',
      tone: outstanding > 0 ? 'warning' : 'default',
    });
  }

  if (options.canReadResponsibleManagerTasks && tasksRes) {
    const openTasks = (tasksRes.data ?? []).length;
    metrics.push({
      label: EXTERNAL_WORKFORCE_LABELS.sponsorAccountability,
      value: String(openTasks),
      href: '/responsible-manager-tasks',
      tone: openTasks > 0 ? 'warning' : 'default',
    });
  }

  if (options.canViewPdpExceptions && exceptions) {
    metrics.push({
      label: 'Governance exceptions',
      value: String(exceptions.length),
      href: '/settings/pdp-exceptions',
      tone: exceptions.length > 0 ? 'critical' : 'default',
    });
  }

  if (options.canViewPdpActivation && activation?.isEmergencyOverrideActive) {
    metrics.push({
      label: 'Policy alerts',
      value: 'Emergency override active',
      href: '/settings/pdp-activation',
      tone: 'critical',
    });
  }

  if (metrics.length === 0) {
    metrics.push({
      label: 'Status',
      value: 'All caught up',
      href: options.canReadSuppliers ? '/suppliers' : '/contractors',
    });
  }

  return {
    id: 'operationsAttention',
    title: "Today's attention",
    health: deriveSectionHealth(metrics),
    metrics,
  };
}

async function loadEngagementAdministrationSection(options: {
  canReadContracts: boolean;
  canReadTimesheets: boolean;
  canReadInvoices: boolean;
  canReadResponsibleManagerTasks: boolean;
  businessSponsor: boolean;
}): Promise<OverviewSection | null> {
  const engagementMetrics: OverviewMetric[] = [];

  const [expiringRes, timesheetsRes, invoicesRes, tasksRes] = await Promise.all([
    options.canReadContracts
      ? api.getContracts({ expiresWithinDays: 30, limit: 1 })
      : Promise.resolve(null),
    options.canReadTimesheets ? api.getTimesheets() : Promise.resolve(null),
    options.canReadInvoices ? api.getInvoices() : Promise.resolve(null),
    options.canReadResponsibleManagerTasks
      ? api.getResponsibleManagerTasks({ status: 'OPEN', limit: 50 })
      : Promise.resolve(null),
  ]);

  if (expiringRes) {
    const expiring = expiringRes.total ?? 0;
    engagementMetrics.push({
      label: 'Contracts expiring (30 days)',
      value: String(expiring),
      href: '/contracts',
      tone: expiring > 0 ? 'warning' : 'default',
    });
  }

  if (timesheetsRes) {
    const pendingTimesheets = (timesheetsRes.data ?? []).filter(
      (t: { status: string }) => t.status === 'SUBMITTED',
    ).length;
    engagementMetrics.push({
      label: 'Outstanding timesheets',
      value: String(pendingTimesheets),
      href: '/timesheets',
      tone: pendingTimesheets > 0 ? 'warning' : 'default',
    });
  }

  if (invoicesRes) {
    const outstanding = (invoicesRes.data ?? []).filter(
      (i: { status: string }) => i.status === 'SUBMITTED' || i.status === 'APPROVED',
    ).length;
    engagementMetrics.push({
      label: 'Outstanding invoices',
      value: String(outstanding),
      href: '/invoices',
      tone: outstanding > 0 ? 'warning' : 'default',
    });
  }

  if (tasksRes) {
    const openTasks = (tasksRes.data ?? []).length;
    engagementMetrics.push({
      label: EXTERNAL_WORKFORCE_LABELS.sponsorAccountability,
      value: String(openTasks),
      href: '/responsible-manager-tasks',
      tone: openTasks > 0 ? 'warning' : 'default',
    });
  }

  if (engagementMetrics.length === 0) {
    return null;
  }

  return {
    id: 'engagementAdministration',
    title: options.businessSponsor
      ? 'Sponsor engagement'
      : CAPABILITY_NAV_LABELS.engagementAdministration,
    health: deriveSectionHealth(engagementMetrics),
    metrics: engagementMetrics,
  };
}

function AttentionInboxCard({ section }: { section: OverviewSection }) {
  if (section.metrics.length === 0) return null;

  return (
    <section className="card" data-testid={`overview-section-${section.id}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">
        {section.title}
      </h3>
      <ul className="space-y-3">
        {section.metrics.map((metric) => (
          <li key={metric.label}>
            <Link
              href={metric.href}
              className="flex items-center justify-between gap-4 rounded-md px-1 py-0.5 hover:bg-gray-50"
            >
              <span className="text-sm text-gray-700">{metric.label}</span>
              <span className={`text-sm font-semibold ${toneClass(metric.tone)}`}>
                {metric.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OverviewSectionCard({ section }: { section: OverviewSection }) {
  if (section.metrics.length === 0) return null;

  return (
    <section className="card" data-testid={`overview-section-${section.id}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {section.title}
        </h3>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${healthBadgeClass(section.health)}`}
          data-testid={`overview-health-${section.id}`}
        >
          {healthLabel(section.health)}
        </span>
      </div>
      <ul className="space-y-3">
        {section.metrics.map((metric) => (
          <li key={metric.label}>
            <Link
              href={metric.href}
              className="flex items-center justify-between gap-4 rounded-md px-1 py-0.5 hover:bg-gray-50"
            >
              <span className="text-sm text-gray-600">{metric.label}</span>
              <span className={`text-sm font-semibold ${toneClass(metric.tone)}`}>
                {metric.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CapabilityOverview() {
  const { can, user } = useAuth();
  const portalUser = isSupplierPortalUser(can);
  const businessSponsor = isHcmLinkedResponsibleManagerView(user, can);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<OverviewSection[]>([]);

  const loadOverview = useCallback(async () => {
    setLoading(true);

    try {
      if (portalUser) {
        const section = await loadSupplierPortalAttentionSection({
          canReadContractors: can(PERMISSIONS.SUPPLIER_CONTRACTORS.READ),
          canReadTimesheets: can(PERMISSIONS.SUPPLIER_TIMESHEETS.READ),
          canReadInvoices: can(PERMISSIONS.SUPPLIER_INVOICES.READ),
        });
        setSections([section]);
        return;
      }

      const canReadSuppliers = can(PERMISSIONS.SUPPLIERS.READ);
      const canReadSupplierApprovals =
        can(PERMISSIONS.SUPPLIERS.APPROVE) || can(PERMISSIONS.SUPPLIERS.SUSPEND);
      const canReadContractors = can(PERMISSIONS.CONTRACTORS.READ);
      const canReadContracts = can(PERMISSIONS.CONTRACTS.READ);
      const canReadTimesheets = can(PERMISSIONS.TIMESHEETS.READ);
      const canReadInvoices = can(PERMISSIONS.INVOICES.READ);
      const canReadResponsibleManagerTasks =
        can(PERMISSIONS.RESPONSIBLE_MANAGER_TASKS.READ) && (user?.responsibleManagerAccountabilityInboxEnabled ?? false);
      const canViewPdpExceptions = can(PERMISSIONS.PDP_EXCEPTIONS.VIEW);
      const canViewPdpActivation = can(PERMISSIONS.PDP_ACTIVATION.VIEW);

      if (businessSponsor) {
        const engagementSection = await loadEngagementAdministrationSection({
          canReadContracts,
          canReadTimesheets,
          canReadInvoices,
          canReadResponsibleManagerTasks,
          businessSponsor,
        });
        setSections(engagementSection ? [engagementSection] : []);
        return;
      }

      const attentionSection = await loadOperationsAttentionSection({
        canReadSuppliers,
        canReadSupplierApprovals,
        canReadContractors,
        canReadContracts,
        canReadTimesheets,
        canReadInvoices,
        canReadResponsibleManagerTasks,
        canViewPdpExceptions,
        canViewPdpActivation,
      });

      setSections([attentionSection]);
    } finally {
      setLoading(false);
    }
  }, [can, portalUser, businessSponsor, user?.responsibleManagerAccountabilityInboxEnabled]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const visibleSections = useMemo(
    () => sections.filter((section) => section.metrics.length > 0),
    [sections],
  );

  const useInboxLayout = portalUser || !businessSponsor;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-500" data-testid="overview-loading">
        Loading today&apos;s attention…
      </div>
    );
  }

  if (visibleSections.length === 0) {
    return (
      <p className="text-sm text-gray-500" data-testid="overview-empty">
        No summaries are available for your current permissions.
      </p>
    );
  }

  if (useInboxLayout) {
    return (
      <div data-testid="attention-inbox">
        {visibleSections.map((section) => (
          <AttentionInboxCard key={section.id} section={section} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
      data-testid="capability-health"
    >
      {visibleSections.map((section) => (
        <OverviewSectionCard key={section.id} section={section} />
      ))}
    </div>
  );
}
