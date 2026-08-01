/**
 * Legacy workbook tab names that customers may still have from older templates.
 * Intentionally isolated so drift checks can allowlist this file only.
 */
export const LEGACY_SUPPLEMENTAL_WORKBOOK_TAB = 'taxprofiles' as const;

export function hasLegacySupplementalWorkbookTab(sheetNames: string[]): boolean {
  const lower = new Set(sheetNames.map((s) => s.toLowerCase()));
  return lower.has(LEGACY_SUPPLEMENTAL_WORKBOOK_TAB);
}
