# External Workforce Platform — Current-State Discovery

**Purpose:** Support **Contractor Operating Model v1** with a repo-backed audit of domain, schema, RBAC, integrations, and extensibility **before** architectural amendments.

**Audience:** Developers and architects answering “what already exists,” “what is scaffold,” “what is hardcoded,” “what is missing,” and “what can be extended cleanly.”

**How to use:** Each section lists **discovery questions** followed by **current-state notes** grounded in this repository (Prisma schema, Nest services, seed, frontend nav). Where the code does not answer a question, it is marked **UNKNOWN / not encoded** for stakeholders.

**Workshop / external discovery (questions only):** [Appendix A — verbatim questionnaire](#appendix-a--external-workforce-operating-model-discovery-questionnaire-verbatim).

---

## Executive instruction

```text
We are defining Contractor Operating Model V1 and need a repo-backed current-state audit of domain, schema, RBAC, integration points, and extensibility before architectural amendments.
```

**Final instruction to developers**

```text
Do not propose target-state redesign first.
First provide repo-backed current-state truth, encoded assumptions, and amendment paths.
```

---

## SECTION A — Domain model / schema

### Goal

Understand what entities exist and where design assumptions are encoded.

---

### A.1 Contractor entity

**Ask**

```text
Please provide the full Contractor schema/model (Prisma + DTOs + services), including:
- Required fields
- Optional fields
- Enums
- supplierId nullability
- workerClassification values
- engagementModel values
- user/account linkage
- lifecycle status fields
```

**Repo-backed current state**

| Topic | Fact |
|--------|------|
| **Source of truth** | `backend/prisma/schema.prisma` → `model Contractor`; domain logic in `backend/src/domain/contractors/` |
| **Required** | `supplierId` (**not nullable**), identity fields (`firstName`, `lastName`, `email`), `engagementModel` |
| **Optional** | `phone`, `idNumber`, `passportNumber`, tax fields, `skills[]`, `accessExpiresAt`, `dateOfBirth` |
| **Enums** | `workerClassification` — currently only **`INDEPENDENT_CONTRACTOR`** in enum; `engagementModel` — **`DIRECT` \| `AGENCY`** |
| **User linkage** | Optional `User.contractorId` → `Contractor` (contractor can exist **without** a login user) |
| **Lifecycle** | `isActive`, `accessExpiresAt`; no separate state machine enum for contractor lifecycle in schema |
| **Archetypes** | **Single-model bias:** schema does not distinguish “supplier resource” vs “internal temp” as separate contractor types; only `DIRECT` / `AGENCY` and tax/engagement layers add nuance |

DTOs and service validation should be read alongside `contractors.service.ts` for create/update rules.

---

### A.2 Supplier entity

**Ask**

```text
Please provide Supplier schema and intended business role:
- Legal entity only?
- Can supplier represent individual?
- Supplier admin concept exists?
- Supplier user/login support?
- Multi-supplier segmentation?
```

**Repo-backed current state**

| Topic | Fact |
|--------|------|
| **Schema** | `model Supplier` — `organizationId`, `type` (**`COMPANY` \| `INDIVIDUAL`**), `status`, company **or** individual name fields, banking, tax, documents |
| **Business role (encoded)** | Supplier/party under the **tenant org**; has many `Contractor`, `SupplierContract`, `Invoice` |
| **Individual supplier** | **Yes** — `SupplierType.INDIVIDUAL` with `firstName` / `lastName` / `idNumber` |
| **Supplier admin / supplier login** | **No** `supplierId` on `User`; no seeded “supplier portal” role in `seed.ts`. Suppliers are **data**, not a first-class auth persona in the reviewed model |
| **Multi-supplier** | **Yes** — many suppliers per `Organization`; contractors are scoped to one supplier each |

---

### A.3 Contract + Engagement model

**Ask**

```text
Please clarify:
- Difference between Contract and Engagement
- SupplierContract vs ContractorEngagement
- Can one supplier have many contractors?
- Can one contractor have multiple engagements?
- Is sponsor modeled anywhere?
```

**Repo-backed current state**

| Topic | Fact |
|--------|------|
| **`SupplierContract`** | MSA-style agreement: `supplierId`, `organizationId`, `contractNumber`, `contractType`, dates, `totalValue`, `rateCard` JSON, `status`, links to `ContractorEngagement[]` |
| **`ContractorEngagement`** | Assignment of a **contractor** to a **supplier contract** (and optional `projectId`), `role`, dates, `rateType` / `rateAmount`, optional `costCenterId`; `isActive` |
| **Relationship** | Contract = commercial frame; Engagement = contractor placement + commercial rate under that contract |
| **One supplier, many contractors** | **Yes** — `Supplier.contractors[]` |
| **One contractor, many engagements** | **Yes** — `Contractor.engagements[]` (no unique constraint preventing overlap; business rules in services) |
| **Sponsor** | **Not modeled** as `sponsorId` / employee link on Contractor, Engagement, or Project. `Project.clientName` exists; not a sponsor workflow |

---

## SECTION B — Identity & access model

### Goal

Determine whether external identity governance already partially exists.

---

### B.1 User model

**Ask**

```text
Please provide User schema:
- Can contractors log in?
- Can suppliers log in?
- Can a contractor exist without User?
- contractorId linkage?
- supplierId linkage?
```

**Repo-backed current state**

| Topic | Fact |
|--------|------|
| **`User`** | `email`, `passwordHash` (nullable for federated), `userType` (`INTERNAL`, `FEDERATED`, `CONTRACTOR`, `API_INTEGRATION`), `externalId` / `externalProvider` for HCM, `organizationId` (nullable for global admin pattern), `contractorId?` |
| **Contractor login** | **Yes** — seed includes `UserType.CONTRACTOR` + `CONTRACTOR` role; `contractorId` links `User` ↔ `Contractor` |
| **Supplier login** | **No** `supplierId` on `User` in schema |
| **Contractor without User** | **Yes** — `contractorId` optional on `User` |
| **Supplier without User** | N/A — supplier is not a user row |

---

### B.2 Access assumptions (badge, risk, compliance)

**Ask**

```text
What current fields or logic indicate:
- Badge/physical access
- Logical access
- Role pack
- Risk
- Background check
- Compliance
```

**Repo-backed current state**

| Topic | Fact |
|--------|------|
| **Physical / badge access** | **Not encoded** in reviewed schema as badge or facility fields |
| **Logical access** | `User.isActive`, `User.contractorId`, `Contractor.isActive`, `Contractor.accessExpiresAt`, RBAC `Role.permissions` + org-scoped `UserRole` |
| **Risk / compliance (domain)** | `ContractorTaxClassification` (risk score, dominant impression), PDP modules for **policy evaluation** and audit logging — not a full physical-access program |
| **Background check** | **Not found** as first-class entity in schema grep scope |

---

### B.3 Sponsor / manager

**Ask**

```text
Does any current field or relationship represent:
- sponsor_employee_id
- line manager
- requester
- hiring manager
- business owner
```

**Repo-backed current state**

**No dedicated sponsor or hiring-manager foreign key** on Contractor, Engagement, or User. Possible partial stand-ins: `UserRole.assignedBy`, audit `createdBy` / approver IDs on timesheets and invoices — **operational**, not org-structure.

---

## SECTION C — Billing model

### Goal

Understand invoice semantics and visibility.

---

### C.1 Invoice ownership

**Ask**

```text
Please confirm:
- Invoice schema relationships
- supplierId meaning
- organizationId meaning
- Can contractor create invoices?
- Can supplier submit invoices?
- Is invoice client-facing, supplier-facing, or contractor-facing?
```

**Repo-backed current state**

| Topic | Fact |
|--------|------|
| **Relationships** | `Invoice` → `supplierId`, `organizationId`, `lineItems[]`, optional `timesheets[]`, withholding link |
| **`supplierId`** | Supplier party issuing / attributed on the bill |
| **`organizationId`** | Tenant customer org receiving the AP document |
| **Contractor creates?** | API requires `invoices:create`. **Seeded `CONTRACTOR` does not have it** |
| **Supplier submits?** | **No supplier auth path**; submission would be an internal user with permissions |
| **Semantics** | **Org-facing supplier bill** (supplier → organization), not a contractor-issued customer invoice in the schema |

---

### C.2 Invoice visibility by role

**Ask**

```text
For each role: CONTRACTOR, FINANCE_USER, CONTRACTOR_MANAGER, CMS_ADMIN
What invoice data can currently be: listed, viewed, created, approved, paid?
And is visibility org-wide, supplier-wide, or row-scoped?
```

**Repo-backed current state** (`InvoicesService.findAll` / `findOne`)

| Role (seed) | create | read list/detail | approve | pay / mark paid | **Scope** |
|-------------|--------|------------------|---------|-----------------|-----------|
| **CONTRACTOR** | No | Yes (`invoices:read`) | No | No | **Org-wide** (filter is `organizationId` only — **not** restricted to linked contractor’s timesheets) |
| **FINANCE_USER** | No in seed | Yes | Yes | Check controller for `invoices:update` / paid endpoints | **Org-wide** |
| **CONTRACTOR_MANAGER** | No invoice perms in seed | Would be 403 unless roles change | — | — | — |
| **CMS_ADMIN** | Yes (wildcard) | Yes | Yes | Yes | Global/org per access context |

**Gap:** contractor **read** is **over-broad** relative to a “my payments only” persona unless UI/API adds row scope.

---

## SECTION D — RBAC & personas

### Goal

See whether target personas exist.

---

### D.1 Current roles

**Ask**

```text
Please provide:
- Seeded roles
- Permission bundles
- Hidden/internal roles
- Route guards
- Sidebar gating
```

**Repo-backed current state**

| Mechanism | Location |
|-----------|----------|
| **Seeded roles** | `backend/prisma/seed.ts` — `CMS_ADMIN`, `FINANCE_USER`, `CONTRACTOR_MANAGER`, `CONTRACTOR` |
| **Permissions** | String arrays on `Role`; validated against `backend/src/core/auth/permissions.constants.ts` + catalog JSON |
| **Wildcard** | `CMS_ADMIN` uses `*:*`; expanded to full catalog in `auth.service.ts` |
| **API guards** | `JwtAuthGuard`, `PermissionsGuard`, `@Permissions`, `@RequiresOrgContext` on controllers |
| **Sidebar** | `frontend/lib/protected-routes.ts` + `can(permission)` in `frontend/components/dashboard-layout.tsx` |

---

### D.2 Missing personas

**Ask**

```text
Do we currently support:
- Supplier Admin
- Supplier Manager
- Sponsor
- Badge-only worker
- Security reviewer
If not, what would schema/RBAC impact be?
```

**Repo-backed current state**

| Persona | Supported? | Typical impact if added |
|---------|------------|-------------------------|
| **Supplier Admin / Manager** | **No** first-class user | `User.supplierId` or supplier-org mapping + new role packs + portal routes |
| **Sponsor** | **No** | New FK or `Engagement.sponsorUserId` + permissions + PDP if policies reference sponsor |
| **Badge-only worker** | **No** | Identity model extension; likely outside current `UserType` |
| **Security reviewer** | **Partial** — audit read permissions exist for admin-like roles; not a dedicated seeded “security reviewer” persona |

---

## SECTION E — HCM integration

### Goal

Determine bridge capability.

---

### E.1 HCM fields

**Ask**

```text
Is there any current integration or placeholder for:
- employeeId
- managerId
- department
- cost center
- sponsor lookup
- org structure
```

**Repo-backed current state**

| Area | Fact |
|------|------|
| **Org** | `Organization.hcmType`, `hcmConfig` JSON — adapter config |
| **User** | `externalId`, `externalProvider` — HCM user id placeholder |
| **Withholding** | `workerExternalId`, `adapterType`, `externalReference`, `syncStatus` — **HCM worker bridge** for withholding payloads |
| **Project / engagement** | `Project.costCenterId` (string), `ContractorEngagement.costCenterId` (string) — **no** normalized department or manager graph |
| **Sponsor / org structure** | **Not modeled** |

---

### E.2 HCM extensibility

**Ask**

```text
Where would HCM integration best fit:
- User
- Contractor
- Organization
- New Sponsor entity
```

**Developer note (current patterns)**

- **Org-level** config already holds adapter type and JSON.
- **User** already holds federated id for login sync.
- **Withholding** already holds worker external id and sync lifecycle.
- **New canonical entities** (sponsor, position, assignment) would reduce stuffing `Json` blobs — **constitution first** if multiple features depend on them.

---

## SECTION F — IGA integration

### Goal

See whether the platform can act as external identity authority.

---

### F.1 Integration points (identity lifecycle)

**Ask**

```text
Are there current outbound events/APIs/hooks for:
- Create identity
- Update identity
- Suspend
- Terminate
- Badge
- Role requests
```

**Repo-backed current state**

| Capability | Fact |
|------------|------|
| **Outbound IGA / SCIM** | **Not identified** as dedicated IGA module in reviewed tree; `ApiKey` supports scoped service calls |
| **User suspend** | `User.isActive` exists; no generic “identity outbox” table found in quick scan |
| **Badge** | **Not encoded** |

---

### F.2 PDP / workflow engine

**Ask**

```text
Do PDP / governance modules support:
- Approval chains
- Sponsor workflows
- Access governance
Or are they currently policy-only?
```

**Repo-backed current state**

- PDP in repo: **policy decision / activation / exceptions / telemetry** (see `backend/src/pdp/` and ADRs under `docs/security/`).
- **Not** a general-purpose BPM for sponsor chains or badge provisioning unless explicitly extended.
- **Timesheet / invoice** approvals are **resource controllers** + permissions, not PDP-driven state machines in the reviewed flow.

---

## SECTION G — UI / navigation

### Goal

Assess whether future persona split fits the shell.

---

### G.1 Nav architecture

**Ask**

```text
Can current nav support:
- Supplier portal
- Sponsor portal
- Contractor admin portal
Without major shell rewrite?
```

**Repo-backed current state**

- **Single app shell:** `DashboardLayout` + permission-filtered flat `PROTECTED_ROUTES`.
- **Extensible by:** adding routes, permissions, and optional **grouped sections** (presentation-only) without changing auth core.
- **Separate portals** (supplier vs internal) usually want **layout fork or subdomain** — possible incrementally, but not “free” if UX and auth boundaries diverge.

---

### G.2 Dashboard variants

**Ask**

```text
How are dashboard variants selected today?
By role only?
By entity type?
Can we add: Supplier, Sponsor, Badge-only?
```

**Repo-backed current state** (`frontend/app/dashboard/page.tsx`)

1. `analytics:read` → analytics dashboard (expanded admin catalog).
2. Else role name **`CONTRACTOR`** → contractor dashboard.
3. Else role name **`FINANCE_USER`** → finance dashboard.
4. Else → operational dashboard (e.g. manager).

**Not** selected by `engagementModel`, supplier linkage, or sponsor. New variants = extend this decision tree + components.

---

## SECTION H — Technical debt / migration risk

### Goal

Avoid breaking the product unintentionally.

---

### H.1 Schema migration risk

**Ask**

```text
What current assumptions would break if we add:
- contractor_type
- sponsor_employee_id
- access_intent
- physical/logical split
```

**Developer notes**

| Change | Risk |
|--------|------|
| **`supplierId` nullable** | **High** — queries assume supplier org chain; invoices tie to supplier |
| **`contractor_type` / archetype** | **Medium** — new branching in RBAC, UI, and invoice generation |
| **Sponsor FKs** | **Medium** — PDP and approvals may need new subjects |
| **access_intent / physical** | **High** if conflated with existing `isActive` / PDP without clear migration |

---

### H.2 Seed / demo dependencies

**Ask**

```text
Which current demos/tests assume:
- Contractor has invoices
- Contractor logs in
- No supplier portal
- No sponsor
```

**Repo-backed current state**

- **Contractor** seed user has **`invoices:read`** — demos that hit invoice list expose **org-wide** data risk.
- **Contractor login** — explicit in seed (`contractor@…`).
- **Supplier portal / sponsor** — absent from seed and schema as auth personas.
- Tests: grep `seed`, `e2e`, and `__tests__` for `contractor@`, `CONTRACTOR`, invoice APIs when changing visibility.

---

## SECTION I — Recommendations from developers

### Goal

Ground next steps in repo reality.

---

### I.1 Direct ask

```text
Based on current codebase:
What is easiest to amend?
What is highest-risk?
What is most over-assumed today?
What should be constitution first vs implementation later?
```

**Initial answers (to refine after full test pass)**

| Category | Note |
|----------|------|
| **Easiest** | Sidebar grouping and copy (permission-preserving); dashboard variant order; new permissions on existing roles |
| **Highest risk** | Nullable `supplierId`; changing invoice party model; row-level security without performance/index plan |
| **Over-assumed** | “Contractor invoice read = my invoices”; “Finance user = invoice creator” (seed lacks `invoices:create`) |
| **Constitution first** | Billing principal, contractor archetypes, sponsor, and invoice visibility rules — then schema + RBAC + API scoping in one coherent release train |

---

## REQUIRED DELIVERABLE FORMAT (from this discovery)

### A. Current-state matrix (summary)

| Pillar | Exists | Scaffold | Hardcoded | Missing |
|--------|--------|----------|-----------|---------|
| **Domain** | Contractor, Supplier, Contract, Engagement, Timesheet, Invoice, Project, Tax, Withholding | Full sponsor/BPM | Single `WorkerClassification` value; flat contractor model | Supplier user, sponsor, badge |
| **RBAC** | Roles, permissions, guards, org context, sidebar filter | Demo role bundles | Dashboard role-name checks | Row-level invoice scope for contractor |
| **Billing** | Supplier→org invoice, timesheet generation | — | Engagement rate → line item | Contractor-safe read API |
| **HCM** | Org `hcmConfig`, user `externalId`, withholding sync fields | — | String `costCenterId` | Manager graph, dept master |
| **IGA** | Users/sessions | — | — | Outbound provisioning, SCIM |
| **UI** | Permission-based nav, dashboard variants | — | Role name string checks | Archetype-aware IA |

### B. Gap matrix

See companion file: [`CURRENT_STATE_VS_TARGET_GAP_MATRIX.md`](./CURRENT_STATE_VS_TARGET_GAP_MATRIX.md) (target column filled after Operating Model v1 sign-off).

---

## Highest priority questions (if time is limited)

| # | Question | Short answer (repo) |
|---|----------|---------------------|
| 1 | Is contractor modeled as worker, billing principal, or both? | **Primarily worker** under supplier; **billing principal on invoice is supplier → org** |
| 2 | Can supplier personas exist today? | **No** first-class supplier login |
| 3 | Is invoice access over-broad? | **Yes** for `invoices:read` at org scope |
| 4 | Is sponsor concept partially present? | **No** |
| 5 | Easiest path to HCM + IGA bridge? | **Extend existing** `Organization.hcmConfig`, `User.externalId`, `WithholdingInstruction` sync pattern; **add** explicit outbox/entity model only after constitution |

---

## File references (non-exhaustive)

| Area | Path |
|------|------|
| Schema | `backend/prisma/schema.prisma` |
| Seed roles | `backend/prisma/seed.ts` |
| Permissions | `backend/src/core/auth/permissions.constants.ts`, `permissions.catalog.json` |
| Invoices | `backend/src/domain/invoices/invoices.service.ts` |
| Timesheets | `backend/src/domain/timesheets/timesheets.service.ts` |
| Nav | `frontend/lib/protected-routes.ts`, `frontend/components/dashboard-layout.tsx` |
| Dashboard | `frontend/app/dashboard/page.tsx` |
| PDP | `backend/src/pdp/*`, `docs/security/ADR-*-PDP*.md` |

---

## Maintenance

When architecture changes, update this file in the **same PR** as schema or security behavior changes, or open a follow-up doc PR within one sprint.

---

## Appendix A — External Workforce Operating Model Discovery Questionnaire (verbatim)

**Use:** Workshop pack, investor or client discovery, and product–market validation. **This appendix is questions only:** no answers, no repository references, and no encoded product assumptions.

---

### Executive instruction

```text
We are defining Contractor Operating Model V1 and need a repo-backed current-state audit of domain, schema, RBAC, integration points, and extensibility before architectural amendments.
```

---

### Final instruction to developers

```text
Do not propose target-state redesign first.
First provide repo-backed current-state truth, encoded assumptions, and amendment paths.
```

---

## SECTION A — Domain model / schema

### Goal

Understand what entities already exist and where current design assumptions are encoded.

### A.1 Contractor entity

```text
Please provide the full Contractor schema/model (Prisma + DTOs + services), including:
- Required fields
- Optional fields
- Enums
- supplierId nullability
- workerClassification values
- engagementModel values
- user/account linkage
- lifecycle status fields
```

### A.2 Supplier entity

```text
Please provide Supplier schema and intended business role:
- Legal entity only?
- Can supplier represent individual?
- Supplier admin concept exists?
- Supplier user/login support?
- Multi-supplier segmentation?
```

### A.3 Contract + Engagement model

```text
Please clarify:
- Difference between Contract and Engagement
- SupplierContract vs ContractorEngagement
- Can one supplier have many contractors?
- Can one contractor have multiple engagements?
- Is sponsor modeled anywhere?
```

---

## SECTION B — Identity & access model

### Goal

Determine whether external identity governance already partially exists.

### B.1 User model

```text
Please provide User schema:
- Can contractors log in?
- Can suppliers log in?
- Can a contractor exist without User?
- contractorId linkage?
- supplierId linkage?
```

### B.2 Access assumptions

```text
What current fields or logic indicate:
- Badge/physical access
- Logical access
- Role pack
- Risk
- Background check
- Compliance
```

### B.3 Sponsor / manager

```text
Does any current field or relationship represent:
- sponsor_employee_id
- line manager
- requester
- hiring manager
- business owner
```

---

## SECTION C — Billing model

### Goal

Understand invoice semantics.

### C.1 Invoice ownership

```text
Please confirm:
- Invoice schema relationships
- supplierId meaning
- organizationId meaning
- Can contractor create invoices?
- Can supplier submit invoices?
- Is invoice client-facing, supplier-facing, or contractor-facing?
```

### C.2 Invoice visibility

```text
For each role:
- CONTRACTOR
- FINANCE_USER
- CONTRACTOR_MANAGER
- CMS_ADMIN

What invoice data can currently be:
- Listed
- Viewed
- Created
- Approved
- Paid
And is visibility org-wide, supplier-wide, or row-scoped?
```

---

## SECTION D — RBAC & personas

### Goal

Determine whether product already supports target personas.

### D.1 Current roles

```text
Please provide:
- Seeded roles
- Permission bundles
- Hidden/internal roles
- Route guards
- Sidebar gating
```

### D.2 Missing personas

```text
Do we currently support:
- Supplier Admin
- Supplier Manager
- Sponsor
- Badge-only worker
- Security reviewer
If not, what would schema/RBAC impact be?
```

---

## SECTION E — HCM integration

### Goal

Determine existing bridge capability.

### E.1 HCM fields

```text
Is there any current integration or placeholder for:
- employeeId
- managerId
- department
- cost center
- sponsor lookup
- org structure
```

### E.2 HCM extensibility

```text
Where would HCM integration best fit:
- User
- Contractor
- Organization
- New Sponsor entity
```

---

## SECTION F — IGA integration

### Goal

See whether platform can become external identity authority.

### F.1 Integration points

```text
Are there current outbound events/APIs/hooks for:
- Create identity
- Update identity
- Suspend
- Terminate
- Badge
- Role requests
```

### F.2 Workflow engine

```text
Do PDP / governance modules support:
- Approval chains
- Sponsor workflows
- Access governance
Or are they currently policy-only?
```

---

## SECTION G — UI / navigation

### Goal

Determine whether architecture can support future role split.

### G.1 Nav architecture

```text
Can current nav support:
- Supplier portal
- Sponsor portal
- Contractor admin portal
Without major shell rewrite?
```

### G.2 Dashboard variants

```text
How are dashboard variants selected today?
By role only?
By entity type?
Can we add:
- Supplier
- Sponsor
- Badge-only
```

---

## SECTION H — Technical debt / migration risk

### Goal

Avoid breaking current product unnecessarily.

### H.1 Schema migration risk

```text
What current assumptions would break if we add:
- contractor_type
- sponsor_employee_id
- access_intent
- physical/logical split
```

### H.2 Seed/demo dependencies

```text
Which current demos/tests assume:
- Contractor has invoices
- Contractor logs in
- No supplier portal
- No sponsor
```

---

## SECTION I — Recommendations from developers

### Goal

Use developer reality, not theory.

### I.1 Direct ask

```text
Based on current codebase:
What is easiest to amend?
What is highest-risk?
What is most over-assumed today?
What should be constitution first vs implementation later?
```

---

## Required deliverable format

Ask developers to return:

### A. Current state matrix

```text
Domain
RBAC
Billing
HCM
IGA
UI
```

### B. Gap matrix

```text
Current
Target
Gap
Effort
Risk
Recommended sequence
```

---

## Highest priority questions (if time is limited)

### 1

```text
Is contractor currently modeled as worker, billing principal, or both?
```

### 2

```text
Can supplier personas exist today?
```

### 3

```text
Is invoice access over-broad?
```

### 4

```text
Is sponsor concept already partially present?
```

### 5

```text
What is easiest path to HCM + IGA bridge?
```
