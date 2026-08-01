import { ContractorAuthorityMode } from '@prisma/client';

/** Upstream HCM assignment status may drive lifecycle drift only when CMS is not authoritative. */
export function isUpstreamHcmLifecycleDriftEnabled(
  mode: ContractorAuthorityMode,
): boolean {
  return mode === ContractorAuthorityMode.HCM_ONLY;
}

/** HCM attribute / staging mismatch drift — not operational governance when CMS owns contractors. */
export function isUpstreamHcmWorkerSourceDriftEnabled(
  mode: ContractorAuthorityMode,
): boolean {
  return mode === ContractorAuthorityMode.HCM_ONLY;
}
