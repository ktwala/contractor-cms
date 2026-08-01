/**
 * PR-SUPPLIER-PORTAL-DATA-1 — canonical supplier portal API envelope parsing.
 */

export const SUPPLIER_PORTAL_EMPTY_STATES = {
  NO_PROFILE: 'NO_PROFILE',
  NO_CONTRACTORS: 'NO_CONTRACTORS',
  NO_TIMESHEETS: 'NO_TIMESHEETS',
  NO_INVOICES: 'NO_INVOICES',
} as const;

export type SupplierPortalEmptyState =
  (typeof SUPPLIER_PORTAL_EMPTY_STATES)[keyof typeof SUPPLIER_PORTAL_EMPTY_STATES];

export const SUPPLIER_PORTAL_EMPTY_COPY: Record<
  SupplierPortalEmptyState,
  { title: string; description: string }
> = {
  NO_PROFILE: {
    title: 'No supplier profile',
    description: 'No supplier profile linked to this account.',
  },
  NO_CONTRACTORS: {
    title: 'No contractors yet',
    description: 'No contractors assigned to your supplier yet.',
  },
  NO_TIMESHEETS: {
    title: 'No timesheets yet',
    description: 'No timesheets submitted yet.',
  },
  NO_INVOICES: {
    title: 'No invoices yet',
    description: 'No invoices recorded for your supplier yet.',
  },
};

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

export interface SupplierPortalDashboardData {
  profile: {
    available: boolean;
    display_name: string | null;
    status: string | null;
  };
  contractors: { count: number };
  timesheets: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    draft: number;
  };
}

export function isSupplierPortalEnvelope(
  value: unknown,
): value is SupplierPortalEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.status === 'ok' && Boolean(v.supplier_context);
}

export function unwrapSupplierPortalProfile<T extends object>(
  response: unknown,
): {
  profile: T | null;
  emptyState: SupplierPortalEmptyState | null;
  supplierContext: SupplierPortalContext | null;
} {
  if (isSupplierPortalEnvelope(response)) {
    return {
      profile: (response.data as T | null) ?? null,
      emptyState: response.empty_state ?? null,
      supplierContext: response.supplier_context,
    };
  }
  if (response && typeof response === 'object' && 'id' in (response as object)) {
    return {
      profile: response as T,
      emptyState: null,
      supplierContext: null,
    };
  }
  return { profile: null, emptyState: null, supplierContext: null };
}

export function unwrapSupplierPortalList<T>(
  response: unknown,
): {
  items: T[];
  emptyState: SupplierPortalEmptyState | null;
  pagination: SupplierPortalPagination | null;
  supplierContext: SupplierPortalContext | null;
} {
  if (isSupplierPortalEnvelope(response)) {
    const items = Array.isArray(response.data) ? (response.data as T[]) : [];
    return {
      items,
      emptyState: response.empty_state ?? null,
      pagination: response.pagination ?? null,
      supplierContext: response.supplier_context,
    };
  }

  const legacy = response as {
    data?: T[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };

  return {
    items: legacy?.data ?? [],
    emptyState: null,
    pagination:
      legacy?.total != null
        ? {
            total: legacy.total,
            page: legacy.page ?? 1,
            limit: legacy.limit ?? 20,
            totalPages: legacy.totalPages ?? 0,
          }
        : null,
    supplierContext: null,
  };
}

export function unwrapSupplierPortalDashboard(
  response: unknown,
): SupplierPortalDashboardData | null {
  if (isSupplierPortalEnvelope(response)) {
    return response.data as SupplierPortalDashboardData;
  }
  return null;
}

export function unwrapSupplierPortalData<T>(response: unknown): T | null {
  if (isSupplierPortalEnvelope(response)) {
    return (response.data as T) ?? null;
  }
  if (response && typeof response === 'object') {
    return response as T;
  }
  return null;
}
