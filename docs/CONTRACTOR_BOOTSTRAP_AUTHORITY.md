# Contractor bootstrap authority (HCM → CMS)

> **Audience:** Solution architecture, UAT, engineering.
> **Platform:** [`CONNECTOR_GOVERNANCE_PLATFORM.md`](CONNECTOR_GOVERNANCE_PLATFORM.md) · **Demo:** [`CONNECTOR_DEMO_UAT.md`](CONNECTOR_DEMO_UAT.md)

## Product identity

This platform is a **contractor migration + governance** system — not a downstream mirror of HCM lifecycle state.

```text
Oracle HCM  = migration source (bootstrap / controlled waves)
CMS         = operational contractor system after materialization
```

**Product story (demos and roadmap):**

```text
We operationalize trust after enterprise-system ingestion.
```

—not—“we synchronized Oracle.”

### The separation that must not collapse

| Layer | Meaning |
|-------|---------|
| **Bootstrap lineage** | Historical import input, correlation quality, migration waves |
| **Operational governance authority** | Lifecycle, sponsor, PDP, remediation, restrictions |

Without that boundary, remediation becomes incoherent, PDP is externally dictated, and every HCM mismatch becomes fake “risk.”

**After materialize → CMS owns** lifecycle, sponsor, PDP, and remediation. That is the real product boundary.

---

## Authority phases

| Phase | Authority | CMS responsibility |
|-------|-----------|-------------------|
| **1 — Bootstrap** | Oracle HCM | Identity seed, correlation, staging, materialization |
| **2 — Operational** | CMS | Lifecycle, sponsor, restrictions, PDP, remediation |

After materialization:

```text
CMS contractor ≠ shadow copy of HCM worker
```

HCM data becomes **historical bootstrap input**, optional reference, and migration lineage — **not** operational truth.

---

## What the HCM connector is (and is not)

| In scope | Out of scope (for `CMS_ONLY` demo / target) |
|----------|-----------------------------------------------|
| One-time or **controlled migration waves** | Continuous authoritative workforce sync |
| Bootstrap identity correlation | Ongoing upstream lifecycle enforcement |
| Duplicate / anchor detection | Terminated-upstream → CMS auto-disabled |
| Missing supplier link (bootstrap quality) | Worker attribute drift as CRITICAL ops signal |
| Unsponsored contractor (CMS accountability) | HCM assignment status driving `isActive` |
| PDP + operational remediation | Reconciliation that implies HCM owns lifecycle |

**UI name:** **Contractor bootstrap** (`/contractor-sources/oracle-hcm/operations`) — accurate; not “HCM sync authority.”

---

## Governance scan focus (CMS-native)

After bootstrap, **Run CMS governance scan** should elevate **operational trust** signals:

| Strong signal | Why |
|---------------|-----|
| `UNSPONSORED_CONTRACTOR` | CMS sponsor accountability |
| `SUPPLIER_LINK_MISSING` | Enablement / supplier relationship |
| `PERSON_CORRELATION_CONFLICT` | Migration quality (bootstrap) |
| `DUPLICATE_PERSON_ANCHOR` | Identity integrity |
| PDP restrictions | Operational risk |
| Governance holds / remediation | Human resolution loop |

### Minimized on `CMS_ONLY` tenants

| Signal | Treatment |
|--------|-----------|
| `GOVERNANCE_LIFECYCLE_CONFLICT` | **Not detected** — upstream termination vs CMS active is `HCM_ONLY` legacy only |
| `WORKER_SOURCE_DRIFT` | **Not detected** — email/validation mismatch is not operational governance when CMS owns attributes |

On `HCM_ONLY` / `HYBRID`, upstream lifecycle and attribute drift may still surface for legacy or transitional tenants (informational / legacy labels in UI).

### Corrections that preserve doctrine (`CMS_ONLY`)

| Correction | Why it matters |
|------------|----------------|
| `WORKER_SOURCE_DRIFT` disabled for `CMS_ONLY` | Prevents HCM from silently reclaiming attribute authority |
| `GOVERNANCE_LIFECYCLE_CONFLICT` only for `HCM_ONLY` | Upstream termination ≠ CMS ops story on authoritative tenants |
| Label: “Bootstrap lineage note (informational)” | Lineage ≠ operational governance |
| UI: “Bootstrap import ledger” | Migration/import semantics, not continuous sync |
| Flagship: `UNSPONSORED_CONTRACTOR` | CMS-native operational accountability |
| Nav: **Contractor bootstrap** | Ingestion is transitional, not perpetual authority |

---

## Watch: accidental drift inflation

The governance scan must not permanently over-report **bootstrap noise**. Signals such as bootstrap identity review, duplicate person anchor, and supplier link resolution are valid during **migration waves, onboarding, and reconciliation** — but should mature into **time-bound bootstrap exceptions**, not perpetual operational governance objects.

Otherwise the product remains a **migration cleanup console** instead of an **operational contractor governance platform**.

### Target signal maturity (roadmap)

| Category | Long-term importance | Current release posture |
|----------|----------------------|-------------------------|
| Unsponsored contractor | **High** | Flagship — always on |
| Restricted operations (PDP) | **High** | Remediation-driven |
| Contract / engagement expiry | **High** | CMS-native (future emphasis) |
| Governance hold | **High** | Lifecycle + suspend |
| Missing engagement / orphaned contractor | **High** | CMS-native (future) |
| Bootstrap identity conflict | **Transitional** | Valid during waves; should age out |
| Correlation review | **Transitional** | Valid during waves; should age out |
| Supplier link missing | **Transitional** | Bootstrap enablement; ops if unresolved post-cutover |
| Worker source drift | **Informational only** | `HCM_ONLY` only; suppressed on `CMS_ONLY` |

**Implemented (PR-GOV-SIGNAL-LIFECYCLE-1):** third layer — `signalCategory`, immutable `detectedPhase`, `expiresAt`, `suppressAfterCutover`, `lineageOnly` / `operationalImpact`, auto-archive on scan, **`operationalOnly=true` default**. See [`GOVERNANCE_SIGNAL_LIFECYCLE.md`](GOVERNANCE_SIGNAL_LIFECYCLE.md).

---

## Symmetry with supplier doctrine

Two **different** governance authority patterns — UI and docs must reflect both:

| Domain | Upstream | CMS role |
|--------|----------|----------|
| **Suppliers** | Oracle Procurement = supplier master | Operational supplier trust (approve, suspend, PDP) |
| **Contractors** | Oracle HCM = bootstrap only | Operational contractor authority after materialize |

See [`SUPPLIER_GOVERNANCE_OPERATIONS.md`](SUPPLIER_GOVERNANCE_OPERATIONS.md) for procurement evidence trust and supplier approvals.

---

## Demo tenant (`DEMO`)

| Setting | Value |
|---------|--------|
| `contractorAuthorityMode` | `CMS_ONLY` |
| `supplierAuthorityMode` | `ORACLE_ONLY` |

**Flagship scenario:** `HCM-WORKER-DEMO-008` → materialize → governance scan → `UNSPONSORED_CONTRACTOR` → remediation → PDP (contractor stays **ACTIVE** until CMS assigns sponsor).

**Do not** present as primary demo outcome:

- HCM terminated → CMS deactivated
- Worker attribute drift
- Access review / IGA certification as the story

---

## Implementation map

| Concern | Path |
|---------|------|
| Lifecycle drift gate (`HCM_ONLY`) | `backend/src/core/authority/contractor-lifecycle-authority.util.ts` |
| Drift detection | `backend/src/domain/contractor-sources/contractor-source-drift-detection.service.ts` |
| Operator labels | `backend/src/domain/contractor-governance/contractor-governance-remediation.labels.ts`, `frontend/lib/operational-governance-labels.ts` |
| Bootstrap UI | `frontend/components/contractor-sources/HcmConnectorOperationsPanel.tsx`, `HcmConnectorDemoBar.tsx` |
| Nav label | `frontend/lib/protected-routes.ts` — **Contractor bootstrap** |

---

## Related

- [`business/PR-CTR-CONNECTOR-1F_CONTRACTOR_DRIFT_ENGINE.md`](business/PR-CTR-CONNECTOR-1F_CONTRACTOR_DRIFT_ENGINE.md)
- [`business/PR-CTR-CONNECTOR-1G_GOVERNANCE_REMEDIATION.md`](business/PR-CTR-CONNECTOR-1G_GOVERNANCE_REMEDIATION.md)
- [`business/CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md`](business/CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md)
