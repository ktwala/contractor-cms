export type ApiScopeMode = 'org-scoped' | 'global' | 'public';

// CORE PRINCIPLE:
// Organization scope is never supplied by the frontend. It is derived only from the authenticated user session.
// Scoped requests DO NOT contain ?organizationId=... or X-Organization-Id.

export const API_ENDPOINT_CONTRACTS = [
  // Org-scoped resources
  { pattern: /^\/timesheets/, scope: 'org-scoped' },
  { pattern: /^\/invoices/, scope: 'org-scoped' },
  { pattern: /^\/suppliers/, scope: 'org-scoped' },
  { pattern: /^\/contractors/, scope: 'org-scoped' },
  { pattern: /^\/contracts/, scope: 'org-scoped' },
  { pattern: /^\/projects/, scope: 'org-scoped' },
  { pattern: /^\/engagements/, scope: 'org-scoped' },

  // Global administrative resources
  { pattern: /^\/analytics\/dashboard/, scope: 'global' },
  { pattern: /^\/analytics\/financial/, scope: 'global' },
  { pattern: /^\/analytics\/contractors/, scope: 'global' },
  { pattern: /^\/analytics\/projects/, scope: 'global' },
  { pattern: /^\/audit/, scope: 'global' },
  { pattern: /^\/pdp/, scope: 'global' },
  { pattern: /^\/users/, scope: 'global' },
  { pattern: /^\/roles/, scope: 'global' },
  { pattern: /^\/organizations/, scope: 'global' },
  { pattern: /^\/settings/, scope: 'global' },

  // Public / auth resources
  { pattern: /^\/auth/, scope: 'public' },
] as const;

export function resolveApiScope(url?: string): ApiScopeMode {
  if (!url) return 'global';

  const normalized = url.startsWith('/') ? url : `/${url}`;

  const match = API_ENDPOINT_CONTRACTS.find((entry) =>
    entry.pattern.test(normalized),
  );

  return match?.scope ?? 'global';
}
