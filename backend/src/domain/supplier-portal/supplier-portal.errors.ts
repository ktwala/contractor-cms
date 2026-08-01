import { ForbiddenException } from '@nestjs/common';

export const SUPPLIER_MEMBERSHIP_REQUIRED_CODE = 'SUPPLIER_MEMBERSHIP_REQUIRED';

const SUPPLIER_MEMBERSHIP_MESSAGE =
  'Active supplier membership required for supplier portal access';

/** Structured 403 for supplier portal routes without membership (PR-SUPPLIER-PORTAL-DATA-1). */
export function supplierMembershipRequiredException(): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    message: SUPPLIER_MEMBERSHIP_MESSAGE,
    error: 'Forbidden',
    code: SUPPLIER_MEMBERSHIP_REQUIRED_CODE,
  });
}

export function isSupplierMembershipMessage(message: string): boolean {
  return message.toLowerCase().includes('supplier membership');
}
