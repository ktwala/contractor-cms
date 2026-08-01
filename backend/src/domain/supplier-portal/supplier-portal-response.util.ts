import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  SupplierPortalContext,
  SupplierPortalEmptyState,
  SupplierPortalEnvelope,
  SupplierPortalPagination,
} from './supplier-portal.types';

export function buildSupplierPortalContext(
  accessContext: AccessContext,
  supplierId: string,
): SupplierPortalContext {
  return {
    supplier_id: supplierId,
    organization_id:
      accessContext.targetOrganizationId ??
      accessContext.actorOrganizationId ??
      null,
  };
}

export function wrapSupplierPortalResponse<TData>(
  accessContext: AccessContext,
  supplierId: string,
  data: TData,
  options?: {
    empty_state?: SupplierPortalEmptyState | null;
    pagination?: SupplierPortalPagination;
  },
): SupplierPortalEnvelope<TData> {
  const envelope: SupplierPortalEnvelope<TData> = {
    status: 'ok',
    supplier_context: buildSupplierPortalContext(accessContext, supplierId),
    data,
  };

  if (options?.empty_state) {
    envelope.empty_state = options.empty_state;
  }

  if (options?.pagination) {
    envelope.pagination = options.pagination;
  }

  return envelope;
}
