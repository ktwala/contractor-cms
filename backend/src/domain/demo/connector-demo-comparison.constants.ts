/**
 * PR-DEMO-CONNECTOR-1 — hidden comparison anchors (excluded from registry UIs).
 * Visible suppliers/contractors are created only via connector sync + promote/materialize.
 */

export const COMPARISON_ANCHOR_SUPPLIER_EMAIL = 'anchor-supplier@demo.internal';
export const COMPARISON_ANCHOR_SUPPLIER_COMPANY_PREFIX = '[comparison-anchor]';
export const COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX = 'anchor.';

/** Tax number shared with ORCL-SUP-DEMO-002 for possible-match staging. */
export const COMPARISON_ANCHOR_TAX_NUMBER = '9876543210';

export function isComparisonAnchorSupplier(record: {
  email?: string | null;
  companyName?: string | null;
}): boolean {
  const email = record.email?.trim().toLowerCase() ?? '';
  const company = record.companyName?.trim() ?? '';
  return (
    email === COMPARISON_ANCHOR_SUPPLIER_EMAIL ||
    company.startsWith(COMPARISON_ANCHOR_SUPPLIER_COMPANY_PREFIX)
  );
}

export function isComparisonAnchorContractor(record: {
  email?: string | null;
}): boolean {
  return (record.email?.trim().toLowerCase() ?? '').startsWith(
    COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX,
  );
}

/** Prisma fragments — keep dashboard/telemetry aligned with registry list APIs. */
export function excludeComparisonAnchorContractorsWhere() {
  return {
    NOT: { email: { startsWith: COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX } },
  };
}

export function excludeComparisonAnchorSuppliersWhere() {
  return {
    AND: [
      { NOT: { email: COMPARISON_ANCHOR_SUPPLIER_EMAIL } },
      {
        OR: [
          { companyName: null },
          {
            NOT: {
              companyName: { startsWith: COMPARISON_ANCHOR_SUPPLIER_COMPANY_PREFIX },
            },
          },
        ],
      },
    ],
  };
}
