/**
 * Display name for suppliers embedded on contractor (and similar) views.
 * Avoids "null null" when API omits type or individual names are null.
 */
export type SupplierDisplayInput = {
  type?: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export function formatSupplierDisplayName(
  supplier: SupplierDisplayInput | null | undefined,
): string {
  if (!supplier) return '-';

  const company = supplier.companyName?.trim();
  if (company) return company;

  if (supplier.type === 'COMPANY') {
    return '-';
  }

  if (supplier.type === 'INDIVIDUAL' || supplier.type === undefined) {
    const first = (supplier.firstName ?? '').trim();
    const last = (supplier.lastName ?? '').trim();
    const full = `${first} ${last}`.trim();
    return full || '-';
  }

  const first = (supplier.firstName ?? '').trim();
  const last = (supplier.lastName ?? '').trim();
  const full = `${first} ${last}`.trim();
  return full || '-';
}
