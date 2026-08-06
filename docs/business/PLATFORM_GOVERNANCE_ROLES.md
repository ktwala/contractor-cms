# Platform governance roles — PR-RBAC-REALIGN-3 baseline

**Status:** **PR-RBAC-REALIGN-3 / 3A / 3B / 3D — COMPLETE** (production RBAC baseline locked).
**Supplier portal invoices:** [`PR-SUPPLIER-PORTAL-INVOICES-1.md`](./PR-SUPPLIER-PORTAL-INVOICES-1.md) — **COMPLETE**.

**Related:** [`SEED_ROLE_BUNDLES_PR_RBAC_REALIGN.md`](./SEED_ROLE_BUNDLES_PR_RBAC_REALIGN.md) · [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md) · [`../GOVERNANCE_TEST_PERSONAS.md`](../GOVERNANCE_TEST_PERSONAS.md) · [`../DEMO_LOGIN_CREDENTIALS.md`](../DEMO_LOGIN_CREDENTIALS.md) · [`../CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md) · [`../SUPPLIER_GOVERNANCE_OPERATIONS.md`](../SUPPLIER_GOVERNANCE_OPERATIONS.md)

**Code references (current bundles):** [`backend/src/core/auth/seed-system-role-bundles.ts`](../../backend/src/core/auth/seed-system-role-bundles.ts) · [`backend/src/core/auth/permissions.constants.ts`](../../backend/src/core/auth/permissions.constants.ts) · [`backend/prisma/seed.ts`](../../backend/prisma/seed.ts)

---

## Critical doctrine

> **Demo super-user is not a production role.**

`workforce.import@ewp.demo` (`GOVERNANCE_OPERATIONS_ADMIN`) is a **UAT composite** — connector ops, supplier approvals, drift visibility, and partial contractor registry access in one login. That convenience must not be mistaken for a production job description or least-privilege bundle.

`ops.admin@ewp.demo` (`CMS_ADMIN`, `*:*`) is **tenant/platform break-glass** — not governance operations and not a day-to-day persona.

Production assigns **narrow roles** from §3. Demo maps those roles to seeded accounts in §6–7.

---

## 1. Role doctrine

### Four operational domains

| Domain | Responsibility | Primary CMS surfaces |
|--------|----------------|----------------------|
| **Integration & bootstrap** | Ingest and reconcile upstream systems (Oracle Procurement, Oracle HCM) | Supplier sync, HCM bootstrap, staging, lineage |
| **Supplier governance** | Decide supplier **operational trust** (approve/suspend/evidence) | Approvals queue, evidence, supplier lifecycle |
| **Contractor governance** | Manage contractor **operational lifecycle** after materialization | Registry, engagements, sponsor accountability, remediation, PDP |
| **Platform governance** | Cross-domain administration, audit, cutover ceremony, oversight | Cutover, governance analytics, audit, org config |

### Authority model (unchanged)

| Area | Authority |
|------|-----------|
| Supplier master | Oracle Procurement (in `ORACLE_ONLY` tenants) |
| Supplier operational trust | CMS |
| Contractor bootstrap identity | Oracle HCM (staging → materialize) |
| Contractor operational lifecycle | CMS (especially post-cutover) |
| Governance remediation | CMS |
| PDP enforcement | CMS |
| Worker classification | Explicit CMS governance metadata (no DB default) |

### Separation principles (PR-RBAC-REALIGN-3)

| Principle | Meaning |
|-----------|---------|
| Bootstrap ≠ trust | Ingestion/reconciliation operators do not approve suppliers or create CMS contractors |
| Trust ≠ master data | Supplier reviewers approve/suspend trust; they do not run Oracle sync |
| Contractor admin ≠ bootstrap | Contractor managers operate the registry after bootstrap; they do not run HCM sync/cutover |
| Sponsor ≠ contractor admin | Sponsors attest legitimacy/accountability; they do not administer the contractor registry |
| Portal ≠ client governance | Supplier portal users are membership-scoped; they never receive client `suppliers:*` or `contractor-migration:*` |

---

## 2. Target production roles

### 2.1 Governance Operations Admin (platform governance — rare)

**Purpose:** Cross-domain governance administration and break-glass orchestration — **not** the default operator for daily supplier/contractor work.

| Capability | Target |
|------------|--------|
| All integration operator capabilities | Optional delegate |
| All supplier reviewer capabilities | Optional delegate |
| Workforce cutover ceremony | Yes (`workforce:cutover-manage`) |
| PDP restriction management | Yes (`pdp-restrictions:manage`) |
| Audit / governance analytics | Yes (read + export) |
| User/role assignment | No (→ CMS Admin) |

**Production use:** Central governance office, cutover ceremony owners, escalation — **small population**.

---

### 2.2 Governance Integration Operator (combined ingestion)

**Purpose:** Unified **supplier sync + contractor bootstrap** — reconciliation and migration operations only.

| Capability | Target |
|------------|--------|
| Run supplier sync | Yes (`suppliers:sync`) |
| Run supplier governance scan | Yes (`suppliers:governance-scan`) |
| Run contractor bootstrap (HCM sync/import/materialize) | Yes (`contractors:bootstrap`) |
| Run contractor governance scan | Yes (`contractors:governance-scan`) |
| View supplier & contractor registries (read-only) | Yes (`suppliers:read`, `contractors:read`) |
| View reconciliation / drift / lineage | Yes (`contractor-migration:read`) |
| View cutover state | Yes (read cutover — `contractor-migration:read` or dedicated read) |

| Cannot | |
|--------|--|
| Create suppliers manually (`suppliers:create`, `suppliers:governance-intake`) | No |
| Approve/suspend suppliers | No |
| Create/edit CMS contractors (`contractors:create`, `contractors:manage`) | No |
| Set workforce cutover | No |
| Resolve PDP / operational remediation | No |

**Owns:** `bootstrap + reconciliation + ingestion governance` — not operational lifecycle governance.

---

### 2.3 Supplier Governance Reviewer

**Purpose:** **Supplier operational trust** only.

| Capability | Target |
|------------|--------|
| View suppliers & evidence | Yes (`suppliers:read`, documents via read paths) |
| Approve supplier governance records | Yes (`suppliers:approve`) |
| Suspend suppliers | Yes (`suppliers:suspend`) |
| Review supplier governance issues / approvals queue | Yes |

| Cannot | |
|--------|--|
| Run supplier sync / import | No |
| Create suppliers in `ORACLE_ONLY` mode | No |
| Run contractor bootstrap / HCM sync | No |
| Contractor registry create/update | No |

**Owns:** `supplier operational trust` — not supplier master data, not workforce bootstrap.

---

### 2.4 Contractor Manager (CMS operational authority)

**Purpose:** Create and manage CMS contractors **after** bootstrap/materialization — primary role **post-cutover**.

| Capability | Target |
|------------|--------|
| Create contractors | Yes (`contractors:create`) |
| Edit contractors / lifecycle | Yes (`contractors:manage` → `contractors:update` + related) |
| Set worker classification | Yes (via contractor create/update) |
| Engagements / contracts (operational) | Yes (`engagements:*`, `contracts:*` as policy dictates) |
| Assign sponsors (CMS fields) | Yes |
| Resolve operational governance issues | Yes (`contractor-remediation:manage`) |
| Resolve PDP restrictions | Yes (`pdp-restrictions:manage`) |
| Timesheets (operational oversight) | Optional (`timesheets:approve`) |

| Cannot | |
|--------|--|
| Run HCM bootstrap / sync | No |
| Run supplier sync | No |
| Set workforce cutover | No |
| Approve suppliers | No |

---

### 2.5 Sponsor / Business Owner

**Purpose:** Accountable person for contractor **legitimacy** on engagements — not contractor registry administration.

| Capability | Target |
|------------|--------|
| View assigned contractors / engagements | Yes (`contractors:read`, `engagements:read`) |
| Sponsor accountability inbox | Yes (`sponsor-tasks:read`, `sponsor-tasks:manage`) |
| Limited engagement updates (sponsor context) | Yes (`engagements:update`) |

| Cannot | |
|--------|--|
| Create contractors | No |
| Run bootstrap/sync | No |
| Approve suppliers | No |
| PDP manage | No |

**Doctrine:** Production sponsors are **HCM employee references** (`sponsorEmployeeId`). CMS inbox (`SPONSOR` role) is **optional demo scaffolding** when `SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true`. See [`SPONSOR_ACCOUNTABILITY_MODEL.md`](./SPONSOR_ACCOUNTABILITY_MODEL.md).

---

### 2.6 Governance Auditor (read-only oversight)

**Purpose:** Audit and oversight **without** operational mutation.

| Capability | Target |
|------------|--------|
| View suppliers, contractors, drifts, remediation | Read-only |
| View audit logs | Yes (`audit:read`) |
| View PDP states / telemetry | Yes (`pdp-*:view`, `pdp-telemetry:view`) |
| Export governance reports | Yes (`governance-analytics:export` where applicable) |

| Cannot | |
|--------|--|
| Create/edit domain data | No |
| Run sync/bootstrap/scans | No |
| Approve/suspend | No |

**Note:** Collapse seed `GOVERNANCE_VIEWER` into this single production role in PR-RBAC-REALIGN-3 implementation.

---

### 2.7 CMS Admin (tenant / platform config)

**Purpose:** Users, roles, organizations, tenant configuration — **not** connector operations.

| Capability | Target |
|------------|--------|
| Users CRUD / deactivate | Yes (`users:*`) |
| Roles CRUD / assign | Yes (`roles:*`) |
| Organizations | Yes (`organizations:*`) |
| Wildcard break-glass | `*:*` acceptable for seeded `CMS_ADMIN` only in non-prod |

| Should not be default for | |
|---------------------------|--|
| Daily supplier sync | → Integration Operator |
| Daily contractor ops | → Contractor Manager |
| Governance approvals | → Supplier Reviewer |

---

### 2.8 Supplier Admin / Supplier Manager (external)

**Scope:** `SupplierMembership` row-level — **never** client `suppliers:*` or `contractor-migration:*`.

| Role | Purpose | Key permissions (current catalog) |
|------|---------|-------------------------------------|
| **SUPPLIER_ADMIN** | Portal org admin — profile, documents, users, contractor requests | `supplier-profile:*`, `supplier-documents:*`, `supplier-users:manage`, `supplier-contractors:*`, `supplier-onboarding:*` |
| **SUPPLIER_MANAGER** | Lighter ops — timesheets + contractor requests | `supplier-profile:read`, `supplier-contractors:*`, `supplier-timesheets:*` |

**Portal defaults:** Supplier-linked contractor requests default to `SUPPLIER_CONTRACTOR` classification; cannot self-approve client governance.

---

### 2.9 Finance Admin (adjacent — not governance ops)

**Purpose:** Invoice amounts, payment status, supplier banking/tax — explicit finance permissions.

Seeded as `FINANCE_USER` with [`FINANCE_ADMIN_PERMISSIONS`](../../backend/src/core/auth/seed-system-role-bundles.ts). Out of scope for governance role matrix except **read overlap** on invoices for auditors.

---

## 3. Current seed bundle mapping

Bundles are defined in [`seed-system-role-bundles.ts`](../../backend/src/core/auth/seed-system-role-bundles.ts) and upserted in [`seed.ts`](../../backend/prisma/seed.ts).

### Client-side system roles (seeded today)

| Seeded role name | Bundle constant | Permissions (explicit) |
|----------------|-----------------|-------------------------|
| `CMS_ADMIN` | inline `*:*` | All permissions |
| `FINANCE_USER` | `FINANCE_ADMIN_PERMISSIONS` | `invoices:*`, finance views, `suppliers:read`, `contractors:read`, `timesheets:approve`, `pdp-*:view`, … |
| `CONTRACTOR_MANAGER` | inline in `seed.ts` | `suppliers:create`, `suppliers:read`, `suppliers:update`, `suppliers:submit-for-approval`, `suppliers:approve`, `suppliers:suspend`, `suppliers:offboard`, `suppliers:archive`, `contractors:create`, `contractors:read`, `contractors:update`, `contracts:*`, `engagements:*`, `timesheets:read`, `timesheets:approve`, `invoices:read`, `tax-classifications:create`, `tax-classifications:read`, `pdp-*:view` |
| `GOVERNANCE_OPERATIONS_ADMIN` | `GOVERNANCE_OPERATIONS_ADMIN_PERMISSIONS` | `suppliers:read`, `suppliers:update`, `suppliers:approve`, `suppliers:suspend`, `contractor-migration:read`, `contractor-migration:manage`, `contractors:read`, `contractors:update`, `audit:read`, `pdp-activation:view`, `pdp-exceptions:view`, `pdp-telemetry:view`, `governance-analytics:view`, `governance-risk:view` |
| `GOVERNANCE_REVIEWER` | `GOVERNANCE_REVIEWER_PERMISSIONS` | `suppliers:read`, `contractor-migration:read`, `contractor-migration:manage`, `contractors:read` |
| `CONTRACTOR_OPERATIONS_USER` | `CONTRACTOR_OPERATIONS_USER_PERMISSIONS` | `contractors:read`, `contractors:update`, `contractor-migration:read` |
| `GOVERNANCE_VIEWER` | `GOVERNANCE_VIEWER_PERMISSIONS` | `suppliers:read`, `contractor-migration:read`, `contractors:read`, `audit:read`, `pdp-activation:view`, `pdp-exceptions:view` |
| `GOVERNANCE_AUDITOR` | `GOVERNANCE_AUDITOR_PERMISSIONS` | `audit:read`, `governance-analytics:view`, `governance-risk:view`, `pdp-exceptions:view`, `pdp-telemetry:view`, `invoices:read`, `contracts:read`, `engagements:read`, `suppliers:read` |
| `SPONSOR` | `SEED_TARGET_ROLE_PERMISSIONS.SPONSOR` | `contractors:read`, `engagements:read`, `engagements:update`, `sponsor-tasks:read`, `sponsor-tasks:manage`, `invoices:read` |

### External supplier roles

| Seeded role | Permissions |
|-------------|-------------|
| `SUPPLIER_ADMIN` | `supplier-profile:*`, `supplier-onboarding:*`, `supplier-documents:*`, `supplier-users:manage`, `supplier-contractors:*`, `profile:*` |
| `SUPPLIER_MANAGER` | `supplier-profile:read`, `supplier-contractors:*`, `supplier-timesheets:*`, `profile:*` |

### Current API coupling (why roles feel “wrong”)

| User intent | Permission enforced today | Controller / route |
|-------------|---------------------------|-------------------|
| Supplier Oracle sync / import | `suppliers:update` | `POST /supplier-sources/oracle/sync`, `import`, reconciliation writes |
| Supplier governance scan (drift detect/assign/resolve) | `suppliers:update` | `POST /supplier-sources/oracle/drift/detect`, `…/assign`, `…/resolve` |
| HCM bootstrap sync / import | `contractor-migration:manage` | `POST /contractor-sources/oracle-hcm/sync`, `import` |
| HCM governance scan | `contractor-migration:manage` | `POST /contractor-sources/oracle-hcm/drift/detect` |
| Workforce cutover set/clear | `contractor-migration:manage` | `POST /contractor-sources/oracle-hcm/cutover` |
| Bootstrap decay apply | `contractor-migration:manage` | `POST /contractor-sources/oracle-hcm/bootstrap-decay/apply` |
| Drift assign/resolve (workforce) | `contractor-migration:manage` | `POST …/drift/:id/assign`, `…/resolve` |
| Contractor remediation lifecycle | `contractor-migration:manage` | `contractor-governance-remediation.controller.ts` |
| CMS contractor create | `contractors:create` | `POST /contractors` |
| PDP restriction manage | `pdp-activation:manage`, `pdp-exceptions:manage` | PDP controllers (not in governance seed bundles) |

---

## 4. Gap table (target vs current seed)

| Target production role | Closest seeded role today | Gap summary |
|------------------------|---------------------------|-------------|
| **Governance Operations Admin** | `GOVERNANCE_OPERATIONS_ADMIN` | Missing `contractors:create`, `pdp-*:manage`, `workforce:cutover-manage` (cutover uses `contractor-migration:manage` today). Has **too much** day-to-day coupling via `suppliers:update` = sync. **Demo-only breadth** — not production least-privilege. |
| **Governance Integration Operator** | *None* — partially `GOVERNANCE_REVIEWER` + `GOVERNANCE_OPERATIONS_ADMIN` | `GOVERNANCE_REVIEWER` incorrectly has `contractor-migration:manage` (bootstrap). No dedicated `suppliers:sync` / `contractors:bootstrap`. `GOVERNANCE_OPERATIONS_ADMIN` also has `suppliers:approve` (trust) — wrong for integration-only. |
| **Supplier Governance Reviewer** | *None pure* — `GOVERNANCE_OPERATIONS_ADMIN` has approve; `CONTRACTOR_MANAGER` has approve + sync | Need role with **only** `suppliers:approve`, `suppliers:suspend`, `suppliers:read` (+ evidence read). Must **deny** `suppliers:update`, `contractor-migration:*`. |
| **Contractor Manager** | `CONTRACTOR_MANAGER` (legacy) / `CONTRACTOR_OPERATIONS_USER` | Legacy `CONTRACTOR_MANAGER` includes **supplier approve + sync**. `CONTRACTOR_OPERATIONS_USER` lacks `contractors:create`, engagements, remediation, PDP manage. Neither matches target. |
| **Sponsor / Business Owner** | `SPONSOR` (optional seed) | Aligned when inbox enabled. Not seeded by default. |
| **Governance Auditor** | `GOVERNANCE_AUDITOR` + `GOVERNANCE_VIEWER` | Two overlapping read roles; viewer includes `contractor-migration:read` (bootstrap panels). Merge to one auditor bundle. |
| **CMS Admin** | `CMS_ADMIN` | Aligned for platform config (`*:*`). Must stay separate from governance ops demo user. |
| **Supplier Admin / Manager** | `SUPPLIER_ADMIN`, `SUPPLIER_MANAGER` | Aligned — portal scope is correct. |

### Legacy roles to deprecate (post realign)

| Legacy seed role | Problem |
|------------------|---------|
| `CONTRACTOR_MANAGER` | Combines supplier trust + sync + contractor ops — violates domain separation |
| `GOVERNANCE_REVIEWER` | Name implies trust review; bundle grants **bootstrap manage** |
| `GOVERNANCE_OPERATIONS_ADMIN` | Keep name for demo only OR narrow to true “platform governance admin” per §2.1 |

---

## 5. Permission changes required (PR-RBAC-REALIGN-3 implementation)

### 5.1 Proposed catalog additions

Add to [`permissions.constants.ts`](../../backend/src/core/auth/permissions.constants.ts) and [`permissions.catalog.json`](../../backend/src/core/auth/permissions.catalog.json):

| Proposed permission | Replaces / splits | Intended endpoints |
|---------------------|-------------------|-------------------|
| `suppliers:sync` | `suppliers:update` (sync/import/reconcile only) | `POST /supplier-sources/oracle/sync`, `import`, promote/reconcile writes |
| `suppliers:governance-scan` | `suppliers:update` (drift detect/assign/resolve only) | `POST /supplier-sources/oracle/drift/detect`, `assign`, `resolve` |
| `contractors:bootstrap` | `contractor-migration:manage` (ingest/materialize only) | `POST /contractor-sources/oracle-hcm/sync`, `import`, migration admin promote, demo materialize |
| `contractors:governance-scan` | `contractor-migration:manage` (detect/assign/resolve drift only) | `POST /contractor-sources/oracle-hcm/drift/detect`, `assign`, `resolve` |
| `workforce:cutover-manage` | `contractor-migration:manage` (cutover ceremony) | `POST /contractor-sources/oracle-hcm/cutover`, `bootstrap-decay/apply` |
| `contractors:create` | *(exists)* | `POST /contractors` |
| `contractors:manage` | `contractors:update` + policy-selected `engagements:*`, `contracts:*` | Registry CRUD + operational engagements (define explicit sub-perms if SoD requires) |
| `contractor-remediation:manage` | `contractor-migration:manage` on remediation controller | `contractor-governance-remediation.controller.ts` handlers |
| `pdp-restrictions:manage` | `pdp-activation:manage` + `pdp-exceptions:manage` (alias bundle or union) | PDP activation/exception manage routes |

Retain **`contractor-migration:read`** for dashboards, telemetry, drift list, cutover **read**.

### 5.2 Decoupling map (explicit removals)

| Today | Problem | Target |
|-------|---------|--------|
| `suppliers:update` → supplier sync | Conflates master-data writes with Oracle ingestion | Sync requires `suppliers:sync` only |
| `suppliers:update` → governance scan | Reviewers cannot hold update without sync power | Scans require `suppliers:governance-scan` |
| `contractor-migration:manage` → cutover + bootstrap + drift + remediation | Single knob for unrelated powers | Split per §5.1 |
| `CONTRACTOR_MANAGER` → `suppliers:approve` + sync | Contractor ops inherits supplier trust | Strip supplier mutations from contractor manager bundle |
| `GOVERNANCE_OPERATIONS_ADMIN` as production template | Demo composite | Split into Integration Operator + Reviewer + Contractor Manager + rare Platform Admin |

### 5.3 Target bundle sketch (implementation checklist)

| Role | Target permissions (minimum) |
|------|------------------------------|
| `GOVERNANCE_INTEGRATION_OPERATOR` | `suppliers:read`, `suppliers:sync`, `suppliers:governance-scan`, `contractors:read`, `contractor-migration:read`, `contractors:bootstrap`, `contractors:governance-scan`, `workforce:cutover-manage` (no `suppliers:approve`, no `contractors:create` / `contractors:update`, no remediation or PDP manage) |
| `SUPPLIER_GOVERNANCE_REVIEWER` | `suppliers:read`, `suppliers:approve`, `suppliers:suspend` |
| `CONTRACTOR_MANAGER` | `contractors:create`, `contractors:manage`, `contractor-remediation:manage`, `pdp-restrictions:manage`, `contractors:read`, `engagements:*`, `contracts:*` (policy TBD) |
| `GOVERNANCE_OPERATIONS_ADMIN` (production) | `workforce:cutover-manage`, `pdp-restrictions:manage`, `audit:read`, `governance-*:view`, optional read-all |
| `GOVERNANCE_AUDITOR` | read-only union: `suppliers:read`, `contractors:read`, `contractor-migration:read`, `audit:read`, `pdp-*:view`, `governance-analytics:view` |
| `SPONSOR` | unchanged target bundle |
| `CMS_ADMIN` | `*:*` or explicit platform admin set |
| `SUPPLIER_ADMIN` / `SUPPLIER_MANAGER` | unchanged portal bundles |

### 5.4 Implementation phases

| Phase | Work |
|-------|------|
| **3a** | Add catalog permissions; update `@Permissions()` on connector + remediation controllers |
| **3b** | New seed bundles + rename/deprecate legacy roles; migration note for assigned users |
| **3c** | Frontend route guards / sidebar visibility keyed to new permissions |
| **3d** | Update `GOVERNANCE_TEST_PERSONAS.md`, smoke scripts, UAT matrices |

---

## 6. Demo persona mapping

> **Reminder:** Demo personas validate UX and workflows. They are **not** the production role catalog.

| Demo account | Password | Seeded role | Maps to target persona | Production? |
|--------------|----------|-------------|------------------------|-------------|
| `workforce.import@ewp.demo` | `GovOps123!` | `GOVERNANCE_OPERATIONS_ADMIN` | **Composite** — Integration + partial Reviewer + partial Contractor Manager + oversight | **No** — UAT only |
| `governance.reviewer@ewp.demo` | `GovReview123!` | `GOVERNANCE_REVIEWER` | Drift/remediation workflow tester | **No** — rename/split in 3b |
| `engagement.ops@ewp.demo` | `ContractorOps123!` | `CONTRACTOR_OPERATIONS_USER` | Partial Contractor Manager (read/update only) | **No** |
| `governance.viewer@ewp.demo` | `GovView123!` | `GOVERNANCE_VIEWER` | Governance Auditor (partial) | **No** |
| `ops.manager@ewp.demo` | `Manager123!` | `CONTRACTOR_MANAGER` | Legacy all-in-one — **anti-pattern** for production | **No** |
| `ops.admin@ewp.demo` | `Admin123!` | `CMS_ADMIN` | Platform Administrator | Break-glass / lab only |
| `finance@ewp.demo` | `Finance123!` | `FINANCE_USER` | Finance Admin | Yes (finance domain) |
| `supplier.portal@ewp.demo` | `SupplierPortal123!` | `SUPPLIER_ADMIN` | Supplier Admin (portal) | Yes (external) |
| `supplier.admin@ewp.demo` | `SupplierAdmin123!` | `SUPPLIER_ADMIN` | Supplier Admin | Yes (external) |
| `supplier.manager@ewp.demo` | `SupplierManager123!` | `SUPPLIER_MANAGER` | Supplier Manager | Yes (external) |
| `sponsor@ewp.demo` | `Sponsor123!` | `SPONSOR` | Sponsor / Business Owner (inbox demo) | Optional — off by default |

**Canonical connector UAT entry:** `governance.ops@` — documented in [`CONNECTOR_DEMO_UAT.md`](../CONNECTOR_DEMO_UAT.md). Label clearly in UI/docs: *“Demo governance composite — not a production role.”*

---

## 7. UAT test personas

Use these accounts to prove **separation of duties** after PR-RBAC-REALIGN-3 implementation. Until then, tests document **current** behavior and known violations.

### 7.1 Flagship tenant

**Demo Organization** (`DEMO`): `supplierAuthorityMode=ORACLE_ONLY`, `contractorAuthorityMode=CMS_ONLY`.

### 7.2 Persona test matrix (target behavior)

| # | Persona | Account (today) | Must succeed | Must fail (403 / hidden) |
|---|---------|-----------------|--------------|---------------------------|
| 1 | Integration Operator | *TBD seed* — until 3b use `governance.ops@` with documented overrides | Supplier sync, HCM bootstrap, governance scans, view drift | Supplier approve, contractor create, cutover set, PDP manage |
| 2 | Supplier Reviewer | *TBD seed* | `/suppliers/approvals` approve/suspend, evidence review | `POST …/oracle/sync`, HCM bootstrap, `suppliers:update` |
| 3 | Contractor Manager | *TBD seed* — today partially `contractor.ops@` + gaps | `POST /contractors`, edit registry, engagements, remediation, PDP manage | HCM sync, supplier sync, cutover, supplier approve |
| 4 | Sponsor | `sponsor@` (if inbox enabled) | Sponsor tasks, read engagements | Create contractor, sync, approve supplier |
| 5 | Governance Auditor | `governance.viewer@` / `GOVERNANCE_AUDITOR` | View dashboards, audit, PDP view | Any POST sync/bootstrap/approve/remediation transition |
| 6 | CMS Admin | `admin@` | Users, roles, org config | Should not be required for connector demo path |
| 7 | Supplier Portal | `supplier.portal@` | Portal profile, documents, contractor request | Client `/suppliers`, `/contractor-sources/*` |
| 8 | Demo composite (labeled) | `governance.ops@` | End-to-end connector demo | Must be documented as **non-production** |

### 7.3 Regression scripts

```bash
cd backend && npm run db:seed
API_BASE=http://localhost:3010/api/v1 ./scripts/smoke-role-personas.sh
```

Docker:

```bash
docker compose exec backend npm run db:seed
```

**After permission changes:** extend `smoke-role-personas.sh` with negative cases (403) per matrix §7.2.

### 7.4 Flagship scenario (authority-aware)

Documented in [`GOVERNANCE_TEST_PERSONAS.md`](../GOVERNANCE_TEST_PERSONAS.md):

```text
HCM bootstrap (HCM-WORKER-DEMO-008)
→ CMS materialize
→ CMS governance scan → UNSPONSORED_CONTRACTOR (OPERATIONAL)
→ Contractor Manager / remediation assigns sponsor
→ PDP restrictions cleared
```

Role boundaries under test:

- **Integration Operator** — bootstrap + scan only
- **Contractor Manager** — sponsor assignment + remediation + PDP
- **Supplier Reviewer** — not on critical path for this scenario

---

## Appendix A — Minimal production role set

| Role | Needed in production |
|------|----------------------|
| Governance Integration Operator | Yes |
| Supplier Governance Reviewer | Yes |
| Contractor Manager | Yes |
| Sponsor / Business Owner | Yes (reference + optional inbox) |
| Governance Auditor | Yes |
| CMS Admin | Yes |
| Governance Operations Admin (platform) | Small escalation group |
| Supplier Admin / Supplier Manager | Yes (external) |
| Finance User | Yes (parallel domain) |

---

## Appendix B — PR tracking

| Item | Status |
|------|--------|
| `PLATFORM_GOVERNANCE_ROLES.md` (this doc) | **COMPLETE** — baseline |
| **3A** Catalog + controller guards | **COMPLETE** — [`PR-RBAC-REALIGN-3A.md`](./PR-RBAC-REALIGN-3A.md) |
| **3B** Production seed bundles + legacy cleanup | **COMPLETE** — [`PR-RBAC-REALIGN-3B.md`](./PR-RBAC-REALIGN-3B.md) |
| **3D** Negative 403 e2e (SoD) | **COMPLETE** — `rbac-governance-separation.e2e-spec.ts` |
| **3C** Frontend guards / sidebar (full) | Partial (connector panels only; optional polish) |
| **Supplier portal invoices** | **COMPLETE** — [`PR-SUPPLIER-PORTAL-INVOICES-1.md`](./PR-SUPPLIER-PORTAL-INVOICES-1.md) |

### Locked doctrine (production)

```txt
Integration Operator ≠ Supplier Reviewer
Contractor Manager ≠ HCM Bootstrap Operator
Supplier Admin ≠ Supplier Manager
Demo composite (governance.ops@) ≠ Production role template
LEGACY_PERMISSION_SATISFIES — removed (3B); fine-grained grants enforced
```

**PR IDs:** `PR-RBAC-REALIGN-3` · `PR-RBAC-REALIGN-3A` · `PR-RBAC-REALIGN-3B` · `PR-RBAC-REALIGN-3D`
