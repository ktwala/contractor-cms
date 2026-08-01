## Description
Please include a summary of the changes and the related issue. Describe the problem this PR solves and the rationale behind your approach.

## CAP traceability *(mandatory for capability behaviour changes)*

> **Rule:** No implementation PR may change capability behaviour unless it identifies CAP section(s) implemented or modified. See [`docs/business/capabilities/README.md`](../docs/business/capabilities/README.md).

| Field | Value |
|-------|-------|
| **Capability** | *(e.g. Workforce Administration)* |
| **CAP version** | *(e.g. v1.0)* |
| **Implements / modifies** | *(e.g. CAP §6 Commands, CAP §12 invariant 3)* |
| **Contract change?** | **No** / **Yes** — if Yes, CAP version bump **must** precede this PR |

If this PR does **not** change capability behaviour, write **N/A** and one line explaining why (e.g. infra-only, UI copy, test fixture).

## Platform Governance Checks
To maintain our strictly governed security architecture, you **must** review and check off the following impacts. If a section is not applicable to your change, mark it as checked but add "N/A" next to it.

### 🛡️ Security & RBAC Impact
- [ ] **RBAC/Permission Impact**: I have verified that new/modified endpoints have the correct `@Permissions()` guard and do not elevate privileges unintentionally.
- [ ] **Tenant Isolation Impact**: I have verified that org-scoped resources securely derive isolation from the session (`type: 'currentUser'`) and NOT from client-provided parameters.
- [ ] **API Contract Impact**: I confirm the frontend relies solely on the shared `api.ts` interceptor and does not inject `organizationId` or `X-Organization-Id` into requests.
- [ ] **Audit Logging Impact**: I have verified that sensitive mutations (POST/PATCH/DELETE) properly dispatch actionable audit events with rich metadata.

### 🧭 Navigation & UI Impact
- [ ] **Sidebar/Route Impact**: I have verified that any new routes added to the sidebar have a backing `page.tsx` and respect role-based rendering conditionals.

### 🧪 Verification
- [ ] **Tests Added/Updated**: I have added unit or E2E tests covering these changes (including negative test cases for unauthorized access).
- [ ] **Security Drift Check Passed**: I have successfully run `./scripts/security-drift-check.sh` locally without errors.

## Additional Context
Add any other context, screenshots, or videos about the pull request here.
