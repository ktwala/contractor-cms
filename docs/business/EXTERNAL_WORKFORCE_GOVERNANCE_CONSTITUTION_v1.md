# External Workforce Governance Constitution v1

> **Product:** External Workforce Platform (EWP). Renamed from *CMS Multi-Source Governance Constitution* per [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md).

**Status:** RATIFIED (PR-CMS-AUTHORITY-1)
**Applies to:** All supplier/contractor governance PRs after OPERATIONS-1D2

## Core doctrine

| Rule | Statement |
|------|-----------|
| **Source authority** | Upstream systems (Oracle Procurement, Oracle HCM) create **identity** |
| **Governance authority** | CMS creates **operational trust** (evidence, lifecycle, PDP) |
| **Twin pattern** | CMS holds a **governance twin** linked by immutable source keys — not a competing ERP master |

**Executive line:** *Authority creates identity; CMS governs operational trust.*

**Enterprise narrative:** *We operationalize trust after enterprise-system ingestion* — connectors provide bootstrap lineage; CMS provides durable operational governance (not a perpetual migration cleanup console).

## System responsibilities (current client)

| Concern | Authoritative | CMS |
|---------|---------------|-----|
| Supplier legal/vendor master | Oracle Procurement | Operational trust, PDP, portal, contractor enablement |
| Supplier onboarding evidence (`ORACLE_ONLY`) | Oracle Procurement (when synced) | Supplemental checks + operational approval — see [SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md) |
| Contractor bootstrap | Oracle HCM (once / migration waves) | Correlation, materialization, governance establishment |
| Contractor steady state (`CMS_ONLY`) | **CMS** | Lifecycle, sponsor, restrictions, PDP — HCM is lineage only |
| Contractor steady state (`HYBRID`) | Split (see mode matrix) | CMS governance overlay; not continuous HCM lifecycle mirror |

See [CONTRACTOR_BOOTSTRAP_AUTHORITY.md](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md).
| Runtime enforcement | — | CMS PDP |

## Tenant authority modes

Configured per `Organization`:

| Field | Values | Default |
|-------|--------|---------|
| `supplierAuthorityMode` | `CMS_ONLY` \| `ORACLE_ONLY` \| `HYBRID` | `CMS_ONLY` |
| `contractorAuthorityMode` | `CMS_ONLY` \| `HCM_ONLY` \| `HYBRID` | `CMS_ONLY` |

**Demo / current client:** `ORACLE_ONLY` + `HYBRID`

### Supplier modes

| Mode | Master creation | CMS role |
|------|-----------------|----------|
| `CMS_ONLY` | CMS `POST /suppliers` | Full native onboarding |
| `ORACLE_ONLY` | Oracle Procurement only | Governance twin + evidence; **no** client supplier create |
| `HYBRID` | Oracle final; CMS may hold intake requests | Portal-led intake → Oracle → twin (future PR) |

### Contractor modes

| Mode | Identity creation | CMS role |
|------|-------------------|----------|
| `CMS_ONLY` | CMS / portal | Native lifecycle |
| `HCM_ONLY` | HCM only | Legacy: upstream lifecycle drift may apply |
| `CMS_ONLY` | CMS after HCM bootstrap | **Target demo** — CMS owns lifecycle; HCM not continuous authority |
| `HYBRID` | HCM internal; portal external | Transitional split (not continuous sync doctrine) |

## Lifecycle semantics (authority-aware)

**Do not rename enums in v1.** Reinterpret `SupplierStatus` by mode:

| Status | `CMS_ONLY` meaning | `ORACLE_ONLY` meaning |
|--------|--------------------|------------------------|
| `DRAFT` | Pre-submission draft | Rare; intake stub only |
| `PENDING_APPROVAL` | Awaiting ops approval | **Awaiting operational trust** (synced; procurement evidence may be inherited) |
| `ACTIVE` | Approved for operations | Operationally trusted in CMS |
| `SUSPENDED` / `OFFBOARDED` / `ARCHIVED` | Governance blocks | Same |

Target vocabulary (future): `SYNCED_UNGOVERNED` → `PENDING_EVIDENCE` → `ACTIVE` maps to above.

Contractor bootstrap is **not** onboarding: imported workforce pending normalization (`BOOTSTRAPPED` — future PR).

## Canonical keys

| Entity | Immutable upstream key | CMS key |
|--------|------------------------|---------|
| Supplier | `externalSupplierId` + `sourceSystem` | `id` (supplier_guid) |
| Contractor | HCM worker/person id | `id` (contractor_guid) |

## Prohibited flows

When `supplierAuthorityMode = ORACLE_ONLY`:

- `POST /suppliers` (client master create) — **forbidden** unless explicit `suppliers:governance-intake` (never implied by `*:*`)
- Oracle staging import must **not** set `ACTIVE` or bypass evidence
- Supplier portal must **not** expose “Register supplier” / self-registration of masters

## PDP alignment

Existing reason codes remain authoritative:

- `SUPPLIER_NOT_APPROVED` — not operationally trusted
- `MISSING_REQUIRED_DOCS` — evidence incomplete/expired

## PR alignment

| PR | Scope |
|----|--------|
| **AUTHORITY-1** (this) | Constitution, tenant modes, create guard, UI wording, drift |
| DATA-2 | Promote staging → governance twin |
| INT-3 | Oracle/HCM adapters |
| EVIDENCE-4 | Source-aware portal |
| PDP-5 | Authority-aware rules |
| GOV-6 | Dashboards + persona e2e |

## Related docs

- [PR-CMS-OPERATIONS-1D0](./PR-CMS-OPERATIONS-1D0_JURISDICTION_AND_SOURCE_SYSTEM.md)
- [PR-CMS-OPERATIONS-1D1](./PR-CMS-OPERATIONS-1D1_ORACLE_SUPPLIER_STAGING.md)
- [PR-CMS-OPERATIONS-1D2](./PR-CMS-OPERATIONS-1D2_PORTAL_PDP.md)
