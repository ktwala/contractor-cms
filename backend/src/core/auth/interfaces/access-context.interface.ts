export interface AccessContext {
  actorUserId: string;
  actorOrganizationId: string | null;
  targetOrganizationId: string | null;
  isGlobalAccess: boolean;
  /** When set, queries are restricted to this supplier (supplier-portal users). */
  supplierScopeId: string | null;
}
