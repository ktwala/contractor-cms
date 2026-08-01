# Governance test personas (GUI validation)

> **NON-PRODUCTION ONLY** — Seeded by `backend/prisma/seed.ts`. See also [`DEMO_LOGIN_CREDENTIALS.md`](DEMO_LOGIN_CREDENTIALS.md).

**Platform reference:** [`CONNECTOR_GOVERNANCE_PLATFORM.md`](CONNECTOR_GOVERNANCE_PLATFORM.md) · **Supplier governance:** [`SUPPLIER_GOVERNANCE_OPERATIONS.md`](SUPPLIER_GOVERNANCE_OPERATIONS.md) · **Contractor bootstrap:** [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](CONTRACTOR_BOOTSTRAP_AUTHORITY.md) · **Live demo:** [`CONNECTOR_DEMO_UAT.md`](CONNECTOR_DEMO_UAT.md) · **Target roles / RBAC gaps:** [`business/PLATFORM_GOVERNANCE_ROLES.md`](business/PLATFORM_GOVERNANCE_ROLES.md)

The platform is now **authority-aware**, **governance-aware**, **connector-aware**, and **PDP-aware**. One super-admin is not enough for meaningful UI validation — use these personas.

> **Demo super-user is not a production role.** `governance.ops@` (`GOVERNANCE_OPERATIONS_ADMIN`) is a UAT composite — see [`business/PLATFORM_GOVERNANCE_ROLES.md`](business/PLATFORM_GOVERNANCE_ROLES.md).

## Flagship tenant

**Demo Organization** (`DEMO`):

| Setting | Value |
|---------|--------|
| `supplierAuthorityMode` | `ORACLE_ONLY` |
| `contractorAuthorityMode` | `CMS_ONLY` (HCM **bootstrap only** — not continuous sync; CMS authoritative after materialize) |

This is the **canonical enterprise governance tenant** for connector ops, CMS governance scan, operational remediation, and authority-aware UI.

---

## 1. Governance Operations Admin (demo composite — start here for connector UAT)

> **Not a production role.** Use `integration.operator@`, `supplier.reviewer@`, or `contractor.ops@` for separation-of-duties testing.

**UAT composite** for connector monitoring, CMS governance scan, remediation, bootstrap import, supplier approvals, and contractor registry — all in one login.

| Field | Value |
|-------|--------|
| Email | `governance.ops@contractor-cms.com` |
| Password | `GovOps123!` |
| Role | `GOVERNANCE_OPERATIONS_ADMIN` |

### Effective permissions (catalog)

| Intent | Permission (PR-RBAC-REALIGN-3A) |
|--------|--------------------------------|
| Supplier sync | `suppliers:read`, `suppliers:sync` |
| Supplier governance scan | `suppliers:governance-scan` |
| Supplier approvals queue | `suppliers:approve`, `suppliers:suspend` |
| Contractor bootstrap | `contractor-migration:read`, `contractors:bootstrap` |
| Contractor governance scan | `contractors:governance-scan` |
| Workforce cutover | `workforce:cutover-manage` |
| Remediation APIs | `contractor-remediation:manage` |
| Contractors registry | `contractors:read`, `contractors:update` |
| Governance oversight | `audit:read`, `pdp-*:view`, `governance-*:view` |

### Routes to validate

| Surface | Path |
|---------|------|
| Supplier sync | `/supplier-sources/oracle/operations` |
| Supplier approvals | `/suppliers/approvals` |
| Contractor bootstrap | `/contractor-sources/oracle-hcm/operations` |
| Suppliers registry | `/suppliers` |
| Governance tile drill-down | `/suppliers?governanceBucket=synced\|active\|suspended` |

### Supplier workflows to validate

1. **Supplier sync** — import + create governance record (`PENDING_APPROVAL`)
2. **`/suppliers` overview tiles** — each tile opens filtered list or approvals queue (not decorative KPIs)
3. **`/suppliers/approvals`** — approve Oracle-linked supplier to `ACTIVE` without CMS evidence upload (`ORACLE_ONLY` tenant)
4. **403 guard** — `governance.viewer@` must not access approvals queue; `governance.ops@` must (after reseed + fresh login)

### Seeded scenarios visible

**Connector demo playbook:** [`CONNECTOR_DEMO_UAT.md`](CONNECTOR_DEMO_UAT.md) (`npm run seed:connector-demo`)

Legacy named fixtures: [`GOVERNANCE_DEMO_FIXTURES.md`](GOVERNANCE_DEMO_FIXTURES.md)

**Supplier:** `GOV-ORACLE-PENDING-001`, `GOV-ORACLE-DUP-003`, `GOV-ORACLE-POSSIBLE-002`, `GOV-ORACLE-STALE-004`, `GOV-ORACLE-RECON-005`

**Workforce (live connector demo):** `HCM-WORKER-DEMO-008` (flagship unsponsored). Legacy seed fixtures: `HCM-TERM-ACTIVE-001`, etc. — only when `SEED_GOVERNANCE_FIXTURES=true`.

---

## 2. Governance Integration Operator (production)

| Field | Value |
|-------|--------|
| Email | `integration.operator@contractor-cms.com` |
| Password | `IntegrationOps123!` |
| Role | `GOVERNANCE_INTEGRATION_OPERATOR` |

Must run supplier sync + HCM bootstrap; may **read** `/suppliers` and `/contractors` (no create/edit); must **not** access `/suppliers/approvals` or `POST /contractors`.

**Sidebar (connector demo tenant):** Suppliers, Supplier sync, Contractors, Contractor bootstrap.

---

## 3. Supplier Governance Reviewer (production)

| Field | Value |
|-------|--------|
| Email | `supplier.reviewer@contractor-cms.com` |
| Password | `SupplierReview123!` |
| Role | `SUPPLIER_GOVERNANCE_REVIEWER` |

Approvals queue only — must **not** `POST …/oracle/sync` or `POST …/oracle-hcm/sync`.

---

## 4. Governance Reviewer

**Human workflow tester** — drift assignment and remediation lifecycle (no connector admin breadth).

| Field | Value |
|-------|--------|
| Email | `governance.reviewer@contractor-cms.com` |
| Password | `GovReview123!` |
| Role | `GOVERNANCE_REVIEWER` |

### Workflows

- Drift: `CLASSIFIED` → `UNDER_REVIEW` → `RESOLVED`
- Remediation: `OPEN` → `ACKNOWLEDGED` → `VERIFIED` → `CLOSED`

Flagship remediation is pre-assigned to this user.

---

## 3. Supplier Portal Operator

**Oracle-authoritative tenant** portal behavior (`ORACLE_ONLY`).

| Field | Value |
|-------|--------|
| Email | `supplier.portal@contractor-cms.com` |
| Password | `SupplierPortal123!` |
| Role | `SUPPLIER_ADMIN` (membership on Demo Supplier Ltd) |

Also available: `supplier.admin@contractor-cms.com` / `SupplierAdmin123!`

### Validate

- No “Add Supplier” on client suppliers list
- Portal title: **Complete compliance profile**
- Evidence upload + governance review submission
- No supplier master creation

### Route

`/supplier-portal/profile`

---

## 4. Contractor Operations User

Workforce lifecycle and remediation visibility (no connector manage).

| Field | Value |
|-------|--------|
| Email | `contractor.ops@contractor-cms.com` |
| Password | `ContractorOps123!` |
| Role | `CONTRACTOR_OPERATIONS_USER` |

---

## 5. Governance Viewer (read-only)

Catches bugs where buttons disappear, routes partially render, or API succeeds but UI hides actions.

| Field | Value |
|-------|--------|
| Email | `governance.viewer@contractor-cms.com` |
| Password | `GovView123!` |
| Role | `GOVERNANCE_VIEWER` |

Should **see** ops dashboards but **not** governance scan, assign, resolve, or remediation transitions.

---

## Flagship end-to-end scenario (connector demo)

```text
HCM bootstrap import (HCM-WORKER-DEMO-008)
→ CMS materializes contractor (demo.worker.unsponsored08@demo.local)
→ CMS governance scan
→ UNSPONSORED_CONTRACTOR drift (CRITICAL)
→ operational governance remediation (OPEN, PDP on)
→ contractor remains ACTIVE until CMS assigns sponsor
→ governance.reviewer completes acknowledge → verify → close
→ PDP restrictions lifted
```

Login as `governance.ops@` to inspect ops panels; `governance.reviewer@` to drive the workflow.

---

## Reseed

```bash
cd backend && npm run db:seed
# Docker:
docker compose exec backend npm run db:seed
```

---

## Permission naming note

Connector APIs today use **`suppliers:*`** and **`contractor-migration:*`** (not separate `supplier-sources:*` / `integrations.*` catalog entries). Persona bundles map to those real permissions.
