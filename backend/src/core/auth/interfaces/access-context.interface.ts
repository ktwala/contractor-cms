export interface AccessContext {
  actorUserId: string;
  actorOrganizationId: string | null;
  targetOrganizationId: string | null;
  isGlobalAccess: boolean;
  /** Role permission strings (may include `*:*`); used for finance field redaction. */
  effectivePermissions: ReadonlySet<string>;
  /** When set, queries are restricted to this supplier (supplier-portal users). */
  supplierScopeId: string | null;
  /**
   * HCM employee reference for business-responsible-manager row scope (internal accountability owner).
   * Set when internal `User.externalId` is present and actor has sponsor-capable read permissions
   * (PR-HCM-SPONSOR-USERS-1). Not gated on role name `SPONSOR`.
   */
  responsibleManagerEmployeeId: string | null;
}
