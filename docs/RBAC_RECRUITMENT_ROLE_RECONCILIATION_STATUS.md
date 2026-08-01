# Recruitment RBAC Role Reconciliation Status

## Canonical Permissions

All recruitment permissions follow the format `recruitment:<domain>:<action>`.

### Requisitions
| Permission | Description |
|---|---|
| `recruitment:requisitions:create` | Create job requisitions |
| `recruitment:requisitions:view` | View job requisitions |
| `recruitment:requisitions:update` | Update job requisitions |
| `recruitment:requisitions:approve` | Approve job requisitions |
| `recruitment:requisitions:post` | Post approved requisitions |
| `recruitment:requisitions:manage` | Close and manage requisitions |

### Candidates
| Permission | Description |
|---|---|
| `recruitment:candidates:create` | Create candidates |
| `recruitment:candidates:view` | View candidates |

### Applications
| Permission | Description |
|---|---|
| `recruitment:applications:create` | Submit applications |
| `recruitment:applications:view` | View applications |
| `recruitment:applications:manage` | Advance, reject, and manage applications |
| `recruitment:applications:rate` | Rate applications |

### Interviews
| Permission | Description |
|---|---|
| `recruitment:interviews:schedule` | Schedule interviews |
| `recruitment:interviews:view` | View interviews |
| `recruitment:interviews:feedback` | Submit interview feedback |
| `recruitment:interviews:manage` | Complete, cancel, and manage interviews |

### Offers
| Permission | Description |
|---|---|
| `recruitment:offers:create` | Create offers |
| `recruitment:offers:approve` | Approve offers |
| `recruitment:offers:send` | Send offers to candidates |
| `recruitment:offers:view` | View offers |

### Onboarding
| Permission | Description |
|---|---|
| `recruitment:onboarding:create` | Create onboarding workflows |
| `recruitment:onboarding:view` | View onboarding workflows |
| `recruitment:onboarding:complete_tasks` | Complete onboarding tasks |
| `recruitment:onboarding:manage_documents` | Manage required onboarding documents |
| `recruitment:onboarding:upload_documents` | Upload onboarding documents |
| `recruitment:onboarding:verify_documents` | Verify onboarding documents |
| `recruitment:onboarding:manage_equipment` | Manage onboarding equipment requirements |
| `recruitment:onboarding:assign_equipment` | Assign equipment to new hires |
| `recruitment:onboarding:manage_access` | Manage system access provisioning |
| `recruitment:onboarding:provision_access` | Provision system access for new hires |

---

## Role Matrix

| Role | Requisitions | Candidates | Applications | Interviews | Offers | Onboarding |
|---|---|---|---|---|---|---|
| **TALENT_ADMIN** | full | full | full | full | full | full |
| **RECRUITER** | create/view/update | create/view | create/view/manage/rate | schedule/view/manage | create/view | create/view/manage_documents/upload_documents |
| **HIRING_MANAGER** | view/approve/post | view | view/manage/rate | view/feedback | view/approve | view |
| **INTERVIEWER** | - | - | - | view/feedback | - | - |
| **HR_OPERATIONS** | - | view | view | view | view | full operational |
| **TENANT_ADMIN** | full | full | full | full | full | full |
| **PLATFORM_SUPERADMIN** | full (inherited) | full (inherited) | full (inherited) | full (inherited) | full (inherited) | full (inherited) |

### Intentional Broad Access Grants

The following broad access grants are **deliberate governance choices**, not drift:

**TENANT_ADMIN** receives full recruitment access because this role is the tenant-level configuration and operational owner. In a single-tenant deployment, this role typically maps to the Head of HR or People Operations lead who needs visibility and control across all talent functions.

**PLATFORM_SUPERADMIN** inherits all permissions automatically via `PERMISSIONS.map((p) => p.code)` in the seed. This is a break-glass role with mandatory audit logging (see `PermissionsGuard` — every PLATFORM_SUPERADMIN access is logged via `AuditService.logPlatformSuperadminAccess()`). This role should never be assigned for daily operations.

If future compliance review requires tighter TENANT_ADMIN scoping (e.g., removing `recruitment:offers:send` or `recruitment:onboarding:provision_access`), do so by modifying the seed `ROLE_PERM_MAP` entry — not by changing the canonical permission set.

---

## Frontend / Backend Parity Status

| Area | Status | Notes |
|---|---|---|
| Backend canonical registry (`P.*`) | OK | All 30 permissions in `src/common/constants/permissions.ts` |
| Controller decorators | OK | All handlers use `P.*` constants, no inline strings |
| Frontend constants (`P.*`) | OK | Mirror of backend in `admin-portal/src/constants/permissions.ts` |
| Surface capability registry | OK | `admin-portal/src/lib/permissions/recruitmentSurfaceRegistry.ts` |
| Role seeds (`prisma/seed.ts`) | OK | TALENT_ADMIN, RECRUITER, HIRING_MANAGER, INTERVIEWER, HR_OPERATIONS seeded |
| Sidebar nav guard | OK | Talent group gated by `recruitment:requisitions:view` |
| Backend authz tests | OK | `recruitment-permission-registry.spec.ts` covers all handlers |
| Drift check tests | OK | `recruitment-permission-drift.spec.ts` blocks banned variants |

---

## State Machine Rules

### Requisitions
```
DRAFT → APPROVED → POSTED → CLOSED
```
- Only `recruitment:requisitions:approve` can move DRAFT → APPROVED
- Only `recruitment:requisitions:post` can move APPROVED → POSTED
- Only `recruitment:requisitions:manage` can close

### Applications
- Stage changes require `recruitment:applications:manage`
- Rejected applications cannot be advanced unless explicitly reopened
- Rating requires `recruitment:applications:rate`

### Interviews
- Only scheduled interviews can be completed/cancelled
- Feedback requires `recruitment:interviews:feedback`
- Complete/cancel requires `recruitment:interviews:manage`

### Offers
```
CREATED → APPROVED → SENT → ACCEPTED/DECLINED
```
- `recruitment:offers:approve` required before sending
- `recruitment:offers:send` required to deliver to candidate
- `acceptOffer`/`declineOffer` are unauthenticated (JWT-only, no permission decorator)

### Onboarding
- Document verification only after upload
- Equipment assignment tracks item, assignee, date
- Access provisioning tracks system, entitlement, provisioned status
