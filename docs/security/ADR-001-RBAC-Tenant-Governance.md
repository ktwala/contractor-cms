# Architecture Decision Record (ADR): RBAC & Tenant Isolation Governance

**Date**: April 2026  
**Status**: Accepted & Enforced via CI  

## 1. Context & Problem Statement
In a multi-tenant application (Contractor CMS), strict data isolation and Role-Based Access Control (RBAC) are critical to security. Historically, tenant isolation relied on the frontend actively passing `organizationId` query parameters or `X-Organization-Id` headers to the backend to determine data scope. 

This model introduced significant security vulnerabilities:
- **Client-Side Spoofing**: Malicious actors could easily modify query parameters to bypass isolation and view data from other organizations.
- **Frontend Drift**: Developers could inadvertently miss injecting the context parameter, leading to unintentional global reads or 400 Bad Request / 403 Forbidden errors when backend validation pipelines rejected the shape of the request.
- **Permission Bloat**: Unused or "phantom" permissions could accumulate in the system without governance, leading to confusing RBAC administration.

We required a mathematically enforceable, platform-level governance architecture to prevent regressions.

## 2. Decision: "Backend-Sovereign Context & Drift Gates"
We decided to shift all trust away from the client and strictly enforce backend-sovereign session derivation, supported by continuous automated governance.

### 2.1 Backend-Sovereign Tenant Context
The frontend is now strictly prohibited from communicating organization context. 
- All scoped endpoints must use `@RequiresOrgContext({ type: 'currentUser' })`.
- The backend derives the isolation boundary solely by inspecting the validated JWT session payload (`req.user.organizationId`).
- The `ValidationPipe` strictly blocks non-whitelisted parameters (like `organizationId` from the frontend), instantly throwing a `400 Bad Request` if parameter spoofing is attempted.

### 2.2 Strict Permission Catalog Governance
We implemented a canonical Permission Catalog (`permissions.constants.ts`). 
- **No Phantom Permissions**: Every string passed into `@Permissions(...)` in the backend must exist in the catalog.
- **No Dead UI Rules**: Every sidebar item restricted by `requiredPermission:` in `protected-routes.ts` must match the catalog.
- **No Orphan Permissions**: The CI pipeline fails if a permission exists in the catalog but is unused in the application (unless explicitly commented with `// IGNORE_UNUSED`).
- **Super-Admin Protection**: Custom roles created by users are mathematically blocked from receiving the `*:*` wildcard permission.

### 2.3 Automated Drift Gates
To ensure this architecture is never "simplified" or bypassed by future developers, we introduced an un-bypassable CI layer:
- `security-drift-check.sh` runs automatically on all Pull Requests and pushes to `main`.
- It performs static analysis to guarantee that:
  1. `type: 'query'` extraction is never used in `@RequiresOrgContext`.
  2. `organizationId` injection never reappears in the frontend Axios interceptors.
  3. Direct `axios` calls bypassing the central API contract are banned.
  4. The permission catalog is perfectly synchronized with application usage.

## 3. Consequences & Benefits
- **Mathematical Security**: Tenant isolation is no longer dependent on developer diligence. It is a guaranteed byproduct of the architectural pipeline.
- **Pristine API Contract**: The frontend sends purely functional business filters (`page`, `limit`, `status`). It has no awareness or responsibility for security boundaries.
- **Audit-Ready Posture**: With PR governance templates and CI drift gates, any modification to the security boundary requires explicit, conscious action that cannot slip through unnoticed.

**DO NOT ATTEMPT TO BYPASS THESE GATES.** If an endpoint requires cross-tenant visibility, it must be explicitly designed for the `CMS_ADMIN` global role, not patched by breaking the `currentUser` extraction model.
