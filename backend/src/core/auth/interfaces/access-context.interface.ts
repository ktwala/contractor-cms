export interface AccessContext {
  actorUserId: string;
  actorOrganizationId: string | null;
  targetOrganizationId: string | null;
  isGlobalAccess: boolean;
}
