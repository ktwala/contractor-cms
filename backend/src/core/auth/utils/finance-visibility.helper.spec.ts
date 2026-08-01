import {
  redactInvoiceRecord,
  redactSupplierRecord,
} from './finance-visibility.helper';
import { PERMISSIONS } from '../permissions.constants';

describe('finance-visibility.helper (PR-FINANCE-RBAC-1)', () => {
  const operationsOnly = new Set(['*:*']);
  const financeOfficer = new Set([
    '*:*',
    PERMISSIONS.INVOICE_AMOUNTS.VIEW,
    PERMISSIONS.INVOICE_PAYMENT_STATUS.VIEW,
    PERMISSIONS.SUPPLIER_FINANCE.VIEW,
    PERMISSIONS.SUPPLIER_BANK_DETAILS.VIEW,
  ]);

  it('redacts invoice amounts for CMS operator without finance grants', () => {
    const redacted = redactInvoiceRecord(
      {
        id: 'inv-1',
        status: 'SUBMITTED',
        subtotal: 100,
        vatAmount: 15,
        totalAmount: 115,
        paidAt: new Date(),
        paymentReference: 'EFT-1',
        lineItems: [{ amount: 100, unitPrice: 50, quantity: 2 }],
      },
      operationsOnly,
    );

    expect(redacted.totalAmount).toBeNull();
    expect(redacted.paidAt).toBeNull();
    expect(redacted.paymentReference).toBeNull();
    expect((redacted as Record<string, unknown>).financialFieldsRestricted).toBe(
      true,
    );
  });

  it('returns invoice amounts when finance grants are explicit', () => {
    const redacted = redactInvoiceRecord(
      {
        id: 'inv-1',
        status: 'PAID',
        subtotal: 100,
        vatAmount: 15,
        totalAmount: 115,
        paidAt: new Date(),
        paymentReference: 'EFT-1',
        lineItems: [],
      },
      financeOfficer,
    );

    expect(redacted.totalAmount).toBe(115);
    expect(redacted.paymentReference).toBe('EFT-1');
    expect((redacted as Record<string, unknown>).financialFieldsRestricted).toBe(
      false,
    );
  });

  it('redacts supplier bank details for operations-only users', () => {
    const redacted = redactSupplierRecord(
      {
        id: 'sup-1',
        companyName: 'Acme',
        bankAccountNumber: '123',
        vatNumber: 'VAT1',
        paymentTermsDays: 30,
      },
      operationsOnly,
    );

    expect(redacted.bankAccountNumber).toBeNull();
    expect(redacted.vatNumber).toBeNull();
    expect(redacted.paymentTermsDays).toBeNull();
    expect((redacted as Record<string, unknown>).financialFieldsRestricted).toBe(
      true,
    );
  });
});
