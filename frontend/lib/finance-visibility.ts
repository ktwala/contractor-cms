import { PERMISSIONS, type Permission } from '@/lib/permissions.generated';

type CanFn = (permission: Permission) => boolean;

/** Mirrors backend finance field policy (PR-FINANCE-RBAC-1). */
export function canViewInvoiceAmounts(can: CanFn): boolean {
  return can(PERMISSIONS.INVOICE_AMOUNTS.VIEW);
}

export function canViewInvoicePaymentStatus(can: CanFn): boolean {
  return can(PERMISSIONS.INVOICE_PAYMENT_STATUS.VIEW);
}

export function canViewSupplierFinance(can: CanFn): boolean {
  return can(PERMISSIONS.SUPPLIER_FINANCE.VIEW);
}

export function canViewSupplierBankDetails(can: CanFn): boolean {
  return can(PERMISSIONS.SUPPLIER_BANK_DETAILS.VIEW);
}

export function formatRestrictedAmount(): string {
  return '—';
}
