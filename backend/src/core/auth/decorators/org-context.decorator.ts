import { SetMetadata } from '@nestjs/common';

export type OrgContextType = 'body' | 'query' | 'param' | 'currentUser';

export interface OrgContextOptions {
  type: OrgContextType;
  key?: string; // Required for body, query, param (e.g. 'organizationId', 'id')
  lookup?: string; // Required if param needs a DB lookup (e.g. 'Supplier')
}

export const ORG_CONTEXT_KEY = 'orgContext';

export const RequiresOrgContext = (options: OrgContextOptions) =>
  SetMetadata(ORG_CONTEXT_KEY, options);
