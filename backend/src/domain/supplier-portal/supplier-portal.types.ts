export const SUPPLIER_PORTAL_EMPTY_STATES = {
  NO_PROFILE: 'NO_PROFILE',
  NO_CONTRACTORS: 'NO_CONTRACTORS',
  NO_TIMESHEETS: 'NO_TIMESHEETS',
  NO_INVOICES: 'NO_INVOICES',
} as const;

export type SupplierPortalEmptyState =
  (typeof SUPPLIER_PORTAL_EMPTY_STATES)[keyof typeof SUPPLIER_PORTAL_EMPTY_STATES];

export interface SupplierPortalContext {
  supplier_id: string;
  organization_id: string | null;
}

export interface SupplierPortalPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SupplierPortalEnvelope<TData> {
  status: 'ok';
  supplier_context: SupplierPortalContext;
  data: TData;
  empty_state?: SupplierPortalEmptyState | null;
  pagination?: SupplierPortalPagination;
}

export interface SupplierPortalDashboardOnboarding {
  jurisdictionCode: string;
  evidenceComplete: boolean;
  missingCount: number;
  expiredCount: number;
  canSubmit: boolean;
  inApprovalQueue: boolean;
}

export interface SupplierPortalDashboardData {
  profile: {
    available: boolean;
    display_name: string | null;
    status: string | null;
    country: string | null;
    countryCode: string | null;
  };
  onboarding: SupplierPortalDashboardOnboarding | null;
  contractors: {
    count: number;
  };
  timesheets: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    draft: number;
  };
}
