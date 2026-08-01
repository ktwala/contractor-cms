# External Workforce Platform — Vocabulary

**Status:** **FROZEN** — architectural rule (May 2026). Changes require ADR.  
**Master freeze:** [`EWP-V1-ARCHITECTURE-FREEZE.md`](./EWP-V1-ARCHITECTURE-FREEZE.md)  
**Source of truth:** [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) — start here, not this file  
**Authority:** [`ADR-012-External-Workforce-Platform-Naming.md`](./ADR-012-External-Workforce-Platform-Naming.md)  
**UI constants:** [`frontend/lib/external-workforce-labels.ts`](../../frontend/lib/external-workforce-labels.ts)

> **Business terminology evolves independently of implementation terminology. Business concepts are renamed when the architecture changes; implementation artifacts are renamed only when there is clear technical value.**

---

## Onboarding — speak this language

| When discussing… | Use… | Do not use in prose… |
|------------------|------|----------------------|
| Product | External Workforce Platform | CMS (historical v1 only) |
| Business object | External Worker | Contractor (unless pointing at code) |
| Capability | Workforce Administration, Supplier Administration, … | Feature, module |
| Capability contract | CAP (`CAP-WORKFORCE-ADMINISTRATION`, …) | The capability itself |
| Architectural responsibility | Authoritative, Gateway, Cross-cutting | Feature type, module role |
| Code | Contractor | ExternalWorker in TypeScript identifiers |
| Database | Contractor | External worker table |
| API | Contractor (`/contractors` until v2) | `/external-workers` (does not exist) |
| UI product name | **External Workforce** | EWP acronym |

> An **External Worker** is currently implemented by the **`Contractor`** aggregate.

---

## Layer stability

| Layer | Name | Stability |
|-------|------|-----------|
| Product | External Workforce Platform (EWP) | Stable |
| Business object | External Worker | Stable |
| Capability | e.g. Workforce Administration | Stable |
| Implementation | Contractor | Migration layer — unchanged until v2 API or persistence redesign |

### Identity Acquisition — three dimensions (do not collapse)

| Business concept | Meaning | v1 implementation |
|------------------|---------|-------------------|
| **Acquisition Authority** | Who may establish this External Worker? | `Contractor.acquisitionModel` (`SUPPLIER`, `INDEPENDENT`) |
| **Acquisition Channel** | How did they enter? | Intake metadata — not `AcquisitionModel` |
| **Processing Pipeline** | What processing completed? | Staging / batch pipeline — not workforce state |

Speak **Acquisition Authority** in architecture prose; cite **`AcquisitionModel`** when pointing at code. Workday, Fieldglass, CSV are **channels**, not authorities.

### Architectural roles (internal — see [`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md))

| Role | Protects | Terminal operation |
|------|----------|-------------------|
| **Authoritative** | Ownership | Command |
| **Gateway** | Transfer | Publish · Projection |
| **Cross-cutting** | Consumption | Handover · Finding *(predicted)* |

**Compositional stack** ([`ARCHITECTURAL_RESPONSIBILITIES_V1.md`](./ARCHITECTURAL_RESPONSIBILITIES_V1.md)):

```text
Business Truth → Business Area → Architectural Responsibility → Capability → CAP
```

| Role | Protects | Failure mode (falsification) |
|------|----------|------------------------------|
| **Authoritative** | Ownership | Ownership leakage |
| **Gateway** | Transfer | Transfer leakage |
| **Cross-cutting** | Consumption | State leakage · Judgement leakage |

First question for a new capability: **what business truth?** Second: **what responsibility relationship?**

---

## Leave unchanged (implementation)

Do **not** rename without clear technical value:

- `ContractorService`, `ContractorRepository`
- `CreateContractorDto`, `Contractor*` types
- `Contractor` Prisma model
- `/contractors` REST routes
- Repo / package name `contractor-cms`

---

## Documentation style

Prefer **External Worker** in prose:

> The External Worker enters `NOMINATED`.

Use **Contractor** only when referring to schema, DTOs, REST paths, migrations, or code identifiers.

Use **EWP** in architecture docs, ADRs, CAPs, and roadmap — **not** in product UI.

---

## UI labels (implemented)

| Surface | Label |
|---------|--------|
| Browser title / login / sidebar brand | External Workforce |
| Platform landing (nav + page) | Overview — **capability health** (`/dashboard` route unchanged) |
| Engagement accountability nav | Sponsor Accountability |
| Sponsor inbox (sponsor view) | My sponsor accountability |
| Sidebar sections | Supplier Administration, Workforce Administration, Engagement Administration, Governance, Administration |
| Workforce list (nav + page) | External Workers |
| Workforce review | Workforce review |
| Identity intake (nav + page) | Identity Acquisition |
| Detail context | External worker |
| Timeline | Workforce timeline |
| Supplier portal list | External workers |
| Supplier portal section | Supplier portal |
| Governance nav | Audit Logs, Governance Status, Exceptions, Security Insights |
| Supplier Portal (product) | Supplier Portal *(unchanged)* |

**Navigation structure is frozen.** See [`EWP-V1-ARCHITECTURE-FREEZE.md`](./EWP-V1-ARCHITECTURE-FREEZE.md).

---

## v1 closed — operational mode

Architecture is **closed for v1**. **Do not write new governance documents** — use the [Capability Map](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md).

Next work per capability: **CAP → PRs → CERT**. See document budget in the Capability Map.

Next capability work:

- Four operational CAPs **v1.0 RATIFIED** — authoritative backbone complete for v1; Identity Acquisition gateway CAP ratified separately
- [`ADR-013`](./ADR-013-External-Worker-Acquisition-Model.md) **APPROVED** — [`PR-IDENTITY-ACQUISITION-MODEL-1`](./PR-IDENTITY-ACQUISITION-MODEL-1.md) + [`PR-IDENTITY-ACQUISITION-MODEL-2`](./PR-IDENTITY-ACQUISITION-MODEL-2.md) complete
- Next: PDP independent-path rules (ADR-013 Step 7); ops UI for acquire-independent

---

## Related

| Doc | Role |
|-----|------|
| [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md) | Product rename + frozen vocabulary rule |
| [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) | Capability architecture |
