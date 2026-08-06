# Domain Model Recovery v1

**Product:** External Workforce Platform (EWP) — see [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md). *Contractor Management System (CMS)* is the historical v1 name.

**Status:** `RECOVERED` — frozen baseline from repo archaeology (May 2026).
**Purpose:** Reconstruct the **original EWP domain model** before external requirement mapping (e.g. MTN RDS).
**Next:** [`ADR-011-Contractor-Workforce-Administration-Plane.md`](./ADR-011-Contractor-Workforce-Administration-Plane.md)

---

## Executive line

```text
We are not building a second HCM.
We are completing the Contractor Workforce Administration plane inside EWP,
while preserving separation between supplier, identity, engagement, governance, and access.
```

---

## 1. What we were building

The External Workforce Platform is a **governed External Workforce Administration platform** (EWP), not an HR self-service portal.

| Plane | Question it answers | Maturity |
|-------|---------------------|----------|
| **Supplier trust** | Is this supplier operationally trusted? | High |
| **Identity acquisition** | How did this person enter the canonical registry? | High |
| **Engagement / placement** | Where are they placed, for how long, under which sponsor? | Medium |
| **Governance / drift** | Is upstream/downstream truth aligned? | High |
| **Access / IGA** | What access should downstream systems provision? | Medium (substrate) |
| **Workforce administration** | What is their **employment/workforce status** with the client? | **Low** — doctrine only |

The missing domain is **Contractor Workforce Administration** — not “a lifecycle” in the abstract.

---

## 2. Recovered answers (frozen)

### 2.1 Independent vs supplier-backed contractors

**Yes — separate concepts**, on multiple axes:

| Mechanism | Values | Role |
|-----------|--------|------|
| `WorkerClassification` | `SUPPLIER_CONTRACTOR`, `INDEPENDENT_CONTRACTOR`, … | Employment/commercial **class** — explicit at create |
| `ContractorPersonType` | `PERSON_SUPPLIED_WORKER`, `PERSON_INDEPENDENT` | EXTID / IGA plane |
| Operating model §11 | Supplier resource (**default**) vs independent (**supported, not default**) | OD-05 **RESOLVED** |

**Schema today:** `supplierId` is **required** for all contractors. Independent path is **doctrine-approved** but **not schema-enabled** yet.

### 2.2 `engagementModel`

**Commercial pattern** — `DIRECT` \| `AGENCY` — not employment status.

Per [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) §12: commercial definitions; legal paragraph deferred to v1.1.

### 2.3 Supplier vs employment relationship

**Distinct entities and planes** (constitution principle):

```text
Supplier     = commercial party (supplier org)
Contractor   = worker / external person record
Engagement   = placement under SupplierContract + dates + sponsor
Sponsor      = HCM employee accountability (not supplier admin)
Workforce    = CMS legitimacy to exist in extended workforce
```

Supplier lifecycle (`SupplierStatus`) ≠ contractor workforce lifecycle.

### 2.4 Acquisition channels

Multi-source by design — HCM is **one channel**, not the product definition:

| Channel | Role |
|---------|------|
| Oracle HCM | Bootstrap / migration waves → staging → promote |
| Oracle Procurement | Supplier identity ingestion |
| CMS native | `POST /contractors`, supplier portal create |
| File/CSV extract | Admin migration ingest |

See [`CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md`](./CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md), [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md).

**Bootstrap ≠ onboarding.** Identity acquisition ≠ HR employment orchestration.

### 2.5 Is supplier mandatory?

| Layer | Answer |
|-------|--------|
| Doctrine default | **Yes** — relaxing requires ADR + migration |
| Independent archetype | Optional supplier when enabled (OD-05) |
| Schema today | **Mandatory** — `supplierId` NOT NULL |

---

## 3. Multi-lifecycle model (contractor as hub)

```text
                    Supplier
                       │
                       ▼
              Supplier lifecycle
              (trust / portal / sync)
                       │
                       ▼
                  Contractor ◄──────────────────┐
                       │                        │
         ┌─────────────┼─────────────┐          │
         ▼             ▼             ▼          │
   Identity       Engagement    Governance       │
   acquisition    / placement   / drift          │
         │             │             │          │
         └─────────────┼─────────────┘          │
                       ▼                        │
              Access / IGA plane                 │
                       │                        │
                       ▼                        │
         Workforce Administration ◄─────────────┘
         (MISSING — to be completed)
```

**Do not collapse planes.** RDS “contractor lifecycle” mixes HR, identity, access, workflow, and approval — we decompose before mapping.

---

## 4. Missing domain — Contractor Workforce Administration

Owns workforce states (initial v1 set):

```text
NOMINATED
PENDING_APPROVAL
ACTIVE
SUSPENDED
TERMINATED
BLACKLISTED
```

Maps to doctrine [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) §7.1 (subset + `BLACKLISTED` + explicit `PENDING_APPROVAL`).

**Today:** proxied by `Contractor.isActive` + engagement dates — **insufficient** for orchestration and external mapping.

### 4.1 Domain events (workforce plane emits; other planes react)

| Event | Primary owning plane | Existing planes that react |
|-------|----------------------|----------------------------|
| `ContractorNominated` | Workforce | Audit |
| `ContractorActivated` | Workforce | Identity map, IGA outbox, Access enablement |
| `ContractExtended` | Workforce | Engagement (`endDate`), optional IGA refresh |
| `ContractorSuspended` | Workforce | Access (revoke/suspend), Governance signals |
| `ContractorReinstated` | Workforce | Access, Engagement |
| `ContractorTerminated` | Workforce | Access, Sponsor tasks (offboarding), Governance |
| `ContractorBlacklisted` | Workforce | Identity acquisition validation, onboarding block |
| `ContractorRehired` | Workforce | Identity continuity, Engagement reopen |

Workforce plane **does not** execute IGA, HCM push, or supplier sync — it **signals** them.

---

## 5. Deferred schema decision — acquisition model

**Not in v1 implementation.** Documented for post–supplier-backed delivery:

```text
Contractor.acquisitionModel = SUPPLIER | INDEPENDENT

Rules:
  SUPPLIER     → supplierId required
  INDEPENDENT  → supplierId optional; primary sponsor required before ACTIVE
```

Cleaner long-term than overloading `WorkerClassification` alone. **ADR:** [`ADR-013`](./ADR-013-External-Worker-Acquisition-Model.md) **APPROVED** — schema PR pending.

**Do not** nullable `supplierId` before workforce plane + supplier-backed path are proven.

---

## 6. Build increment (mandatory order)

```text
Domain Model Recovery v1          ← this document (FROZEN)
        ↓
Workforce Plane ADR               ← ADR-011 (**APPROVED**)
        ↓
Employment / Workforce State Model   ← **PR-WORKFORCE-STATE-MODEL-1 COMPLETE**
        ↓
Supplier-backed implementation first   portal + internal ops; LM approval TBD
        ↓
Independent contractor schema decision   acquisitionModel ADR + migration
        ↓
External requirement mapping (e.g. MTN RDS)   map features → capabilities, not reshape domain
        ↓
Product identity (EWP)                        ADR-012 — CMS is historical v1 name
```

**Do not start** with full MTN RDS feature set (FE001–FE016).

---

## 7. What we are not building

- A second Oracle HCM (continuous upstream lifecycle mirror as product core)
- Collapsing supplier trust, workforce status, and IGA into one enum
- Nullable `supplierId` without ADR + workforce enforcement
- RDS-driven redesign of the aggregate before workforce plane exists

---

## 8. Primary references

| Document | Role |
|----------|------|
| [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) | Product constitution — planes, archetypes, §7.1 target states |
| [`CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md`](./CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md) | Authority modes, bootstrap vs steady state |
| [`CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md`](./CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md) | Registry + staging + sponsor mapping |
| [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md) | HCM bootstrap ≠ operational lifecycle |
| [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) | CMS ≠ IGA; access plane separation |
| [`ADR-013`](./ADR-013-External-Worker-Acquisition-Model.md) | Acquisition authority model |
| [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md) | Workforce administration plane decision |
| [`ADR-003`](./ADR-003-Contractor-Lifecycle-Governance.md) | PDP visibility/enforcement maturation — **complements** workforce plane, does not replace it |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05 | v1 — archaeology recovery; build increment; acquisitionModel deferred |
