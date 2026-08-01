import { PERMISSIONS } from '../permissions.constants';
import { permissionSatisfied } from './permission-evaluation';

export type FinanceVisibility = {
  canViewInvoiceAmounts: boolean;
  canViewInvoicePaymentStatus: boolean;
  canViewSupplierFinance: boolean;
  canViewSupplierBankDetails: boolean;
};

export function resolveFinanceVisibility(
  permissions: ReadonlySet<string>,
): FinanceVisibility {
  return {
    canViewInvoiceAmounts: permissionSatisfied(
      permissions,
      PERMISSIONS.INVOICE_AMOUNTS.VIEW,
    ),
    canViewInvoicePaymentStatus: permissionSatisfied(
      permissions,
      PERMISSIONS.INVOICE_PAYMENT_STATUS.VIEW,
    ),
    canViewSupplierFinance: permissionSatisfied(
      permissions,
      PERMISSIONS.SUPPLIER_FINANCE.VIEW,
    ),
    canViewSupplierBankDetails: permissionSatisfied(
      permissions,
      PERMISSIONS.SUPPLIER_BANK_DETAILS.VIEW,
    ),
  };
}

/** Redact invoice monetary and payment fields for operational roles. */
export function redactInvoiceRecord<T extends Record<string, unknown>>(
  invoice: T,
  permissions: ReadonlySet<string>,
): T {
  const vis = resolveFinanceVisibility(permissions);
  const redacted: Record<string, unknown> = { ...invoice };

  if (!vis.canViewInvoiceAmounts) {
    redacted.subtotal = null;
    redacted.vatAmount = null;
    redacted.totalAmount = null;
    if (Array.isArray(redacted.lineItems)) {
      redacted.lineItems = (redacted.lineItems as Array<Record<string, unknown>>).map(
        (item) => ({
          ...item,
          quantity: null,
          unitPrice: null,
          amount: null,
        }),
      );
    }
  }

  if (!vis.canViewInvoicePaymentStatus) {
    redacted.paidAt = null;
    redacted.paymentReference = null;
  }

  redacted.financialFieldsRestricted =
    !vis.canViewInvoiceAmounts || !vis.canViewInvoicePaymentStatus;

  return redacted as T;
}

/** Redact supplier banking, tax, and financial profile fields. */
export function redactSupplierRecord<T extends Record<string, unknown>>(
  supplier: T,
  permissions: ReadonlySet<string>,
): T {
  const vis = resolveFinanceVisibility(permissions);
  const redacted: Record<string, unknown> = { ...supplier };

  if (!vis.canViewSupplierBankDetails) {
    redacted.bankName = null;
    redacted.bankAccountNumber = null;
    redacted.bankBranchCode = null;
    redacted.bankAccountType = null;
    redacted.vatNumber = null;
    redacted.taxNumber = null;
    redacted.taxClearanceNumber = null;
    redacted.taxClearanceExpiry = null;
  }

  if (!vis.canViewSupplierFinance) {
    redacted.bbbeeLevel = null;
    redacted.bbbeeExpiry = null;
    redacted.creditLimit = null;
    redacted.paymentTermsDays = null;
  }

  redacted.financialFieldsRestricted =
    !vis.canViewSupplierFinance || !vis.canViewSupplierBankDetails;

  return redacted as T;
}
