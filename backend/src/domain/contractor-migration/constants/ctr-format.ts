/** PR-CTR-5 — immutable business contractor reference format. */
export function formatContractorBusinessId(
  orgCode: string,
  sequence: number,
): string {
  const safeCode =
    orgCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12) || 'ORG';
  return `CTR-${safeCode}-${String(sequence).padStart(8, '0')}`;
}
