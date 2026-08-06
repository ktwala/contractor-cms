# ADR-012: Product Renaming — Contractor Management System → External Workforce Platform

## Status

**APPROVED** — May 2026

**Supersedes naming only** — not capability boundaries, schemas, or APIs.
**Companion:** [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md)
**Vocabulary (frozen):** [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./EXTERNAL_WORKFORCE_VOCABULARY.md)

> **Business terminology evolves independently of implementation terminology. Business concepts are renamed when the architecture changes; implementation artifacts are renamed only when there is clear technical value.**

That explains why the UI says **External Worker**, capabilities say **Workforce Administration**, and code still contains `ContractorService` — intentional, not inconsistent.

---

## Context

The platform began as **Contractor Management System (CMS)** — a governed contractor registry with supplier portal, HCM bootstrap, and governance overlays.

Since domain recovery (May 2026), the platform has proven:

- Supplier-backed **Workforce Administration** (nominate → review → activate; reject / reopen; blacklist)
- Workforce state model, controlled transitions, business timeline
- Multi-source **Identity Acquisition** (HCM, procurement, native, file)
- **Governance** (drift, remediation, evidence)
- Capability map and MTN RDS traceability (external matrix, not backlog driver)

That is a **platform foundation**, not a single “contractor feature set.” The name CMS no longer describes what the system owns.

---

## Decision

### 1. Why the rename?

| Old name implied | Actual scope |
|------------------|--------------|
| Contractor record management | **External workforce administration and governance** |
| One worker type | Supplier contractors today; independent and other types in doctrine |
| HR system extension | **Authoritative platform** that integrates with HCM, IGA, suppliers — not a mirror of them |
| Customer-specific build | **Customer-agnostic capabilities** with customer-specific traceability (e.g. MTN RDS) |

**Core business question (platform):**

> **How does an enterprise administer and govern its external workforce?**

Not: *How do we manage contractors?*

### 2. What changes?

| Area | Change |
|------|--------|
| **Product identity** | **External Workforce Platform (EWP)** |
| **Primary business object (documentation)** | **External Worker** — `Contractor` is one specialization / schema name |
| **Documentation** | Core constitution docs renamed (see migration table) |
| **Roadmap language** | Capability → maturity → PR → product projection → customer traceability |
| **Internal shorthand** | Prefer **EWP** in new docs; **CMS** retained as historical v1 label where needed |

**External Worker model (documentation):**

```text
External Worker
        │
        ├── Workforce
        ├── Engagement
        ├── Identity
        ├── Governance
        ├── Access
        └── Supplier Relationship
```

**Specializations (examples):** Supplier Contractor, Independent Contractor, Consultant, Temporary Worker, Advisor — `WorkerClassification` / future types in schema.

**Product projections** (experiences, not capabilities):

```text
EWP
 ├── Supplier Portal
 ├── Operations Console
 └── Identity Services
```

Future: Mobile Supplier Portal, Executive Dashboard, Vendor API, Analytics Portal — without changing the capability map.

### 3. What does not change?

| Unchanged | Notes |
|-----------|-------|
| **API routes** | e.g. `/contractors`, `/supplier-portal/contractors` |
| **Prisma models** | `Contractor`, `ContractorEngagement`, etc. |
| **Migration history** | Table and enum names |
| **Capability boundaries** | Planes / bounded contexts unchanged |
| **PR identifiers** | e.g. `PR-WORKFORCE-*`, `PR-CMS-*` remain until explicitly renamed |
| **Repo / package names** | `contractor-cms` workspace name is out of scope for this ADR |

**Workforce Administration** remains a **capability within EWP**, not the platform name.

### 4. Migration guidance

**New documentation** uses:

- **External Workforce Platform (EWP)** for the product
- **External Worker** for the primary business object in prose
- **`Contractor`** when referring to schema, code, or API identifiers

**Historical references:** “Contractor Management System (CMS)” is the v1 product name until UI and legacy docs are updated.

**Document renames (canonical paths):**

| Previous | Canonical (post ADR-012) |
|----------|--------------------------|
| `CONTRACTOR_OPERATING_MODEL_V1.md` | [`EXTERNAL_WORKFORCE_OPERATING_MODEL_V1.md`](./EXTERNAL_WORKFORCE_OPERATING_MODEL_V1.md) |
| `CONTRACTOR_ADMINISTRATION_CAPABILITY_MAP.md` | [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) |
| `CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md` | [`EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md`](./EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md) |
| `CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md` | [`EXTERNAL_WORKFORCE_CANONICAL_DATA_MODEL_V1.md`](./EXTERNAL_WORKFORCE_CANONICAL_DATA_MODEL_V1.md) |

Previous paths retain **redirect stubs** pointing here and to the new file.

**Phased rollout:**

1. ADR-012 + capability map + governance index — **complete**
2. Update high-traffic cross-references — **complete**
3. UI business language + vocabulary doc — **complete** (May 2026)
4. Optional: `PR-CMS-*` → `PR-EWP-*` naming in future PRs only when touching those docs

**Rename is complete.** Do not rename `ContractorService`, Prisma models, DTOs, or `/contractors` routes unless a future v2 API or persistence redesign provides clear technical value.

### 5. Frozen vocabulary (architectural rule)

All contributors **SHALL** use this language. Changes require an ADR — not ad hoc renames.

| When discussing… | Use… |
|------------------|------|
| Product | External Workforce Platform (EWP in docs only; **External Workforce** in UI) |
| Business object | External Worker |
| Capability | e.g. Workforce Administration, Supplier Administration |
| Code | Contractor (`ContractorService`, `CreateContractorDto`, …) |
| Database | Contractor (Prisma model, migrations) |
| API | Contractor (`/contractors` until v2) |

Onboarding reference: [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./EXTERNAL_WORKFORCE_VOCABULARY.md).

### 6. Migration sequence (why this felt natural)

```text
Contractor Management System
        ↓
Recover the domain
        ↓
Recover the capabilities
        ↓
Build the Workforce capability
        ↓
Prove the capability
        ↓
Rename the platform
        ↓
Rename the business language (UI + docs)
        ↓
Leave implementation unchanged
```

The rename happened **after** architecture stabilised — not as a big-bang search-and-replace.

---

## Consequences

### Positive

- Stable product identity independent of MTN, Oracle HCM, or “contractor-only” scope
- EWP becomes the **first validated reference implementation** of Hubsec Engineering Method (HEM) — see [`../hubsec-engineering/README.md`](../hubsec-engineering/README.md)
- Clear place for non-contractor external worker types without rebranding again

### Negative / cost

- Dual vocabulary during transition (`Contractor` in code, External Worker in doctrine)
- Large doc corpus still references CMS until phased update
- Stakeholders may conflate rename with breaking API change — communicate **§3 explicitly**

---

## References

| Doc | Role |
|-----|------|
| [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./EXTERNAL_WORKFORCE_VOCABULARY.md) | Business vs implementation terminology |
| [`DOMAIN_MODEL_RECOVERY_V1.md`](./DOMAIN_MODEL_RECOVERY_V1.md) | Domain archaeology (terminology update pending) |
| [`PR-WORKFORCE-RDS-MAPPING-1.md`](./PR-WORKFORCE-RDS-MAPPING-1.md) | MTN customer traceability |
| [`ADR-011`](./ADR-011-Contractor-Workforce-Administration-Plane.md) | Workforce bounded context (unchanged scope) |
