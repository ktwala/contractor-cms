/**
 * PR-HCM-SPONSOR-BRIDGE-1 — pluggable HCM sponsor reference validation (opaque by default).
 * Implementations may perform format checks and optional existence lookups when enabled.
 */
export interface HcmResponsibleManagerLookupProvider {
  /** When false, engagements must not block on HCM validation. */
  isValidationEnabled(): boolean;

  /** Structural validation only (regex / length); no network I/O required. */
  validateReferenceFormat(employeeId: string): boolean;

  /**
   * Optional existence check against HCM (or stub). Only meaningful when
   * {@link isValidationEnabled} is true.
   */
  responsibleManagerExists(organizationId: string, employeeId: string): Promise<boolean>;
}
