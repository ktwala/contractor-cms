# Internal Accountability — canonical domain model

**Status:** Adopted product doctrine (July 2026) — **schema vocabulary rename complete**  
**Audience:** Engineers, architects, demo authors, integration partners  
**Related:** [`WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md`](./WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md) · [`business/SPONSOR_ACCOUNTABILITY_MODEL.md`](./business/SPONSOR_ACCOUNTABILITY_MODEL.md) (historical inbox / IGA bridge doc)

---

## The governance question

> **Who inside the organization is accountable for this external worker?**

EWP answers that with **Internal Accountability** — a platform concept, not a customer job title.

---

## Two layers (do not collapse)

```text
Canonical (platform)
────────────────────
Internal Accountability
  • HCM employee reference on engagement
  • Required before operational trust (with supplier, contract, etc.)
  • Assessment finding when absent: MISSING_INTERNAL_ACCOUNTABILITY

Tenant vocabulary (UI / demo)
─────────────────────────────
MTN default          → Responsible Manager
Other customers      → Line Manager, Engagement Manager, Supervisor, …
```

**Rule:** The canonical layer must be **more abstract** than any tenant label. Never name the platform concept after one customer's HR model.

---

## Default MTN operator language

| Context | Label |
|---------|--------|
| Worker / engagement field | **Responsible Manager** |
| Assessment finding (tile) | **No Responsible Manager assigned** |
| Inline gap | **Responsible Manager not assigned** |
| Resolution action | **Assign a Responsible Manager** |

Implementation: [`frontend/lib/external-workforce-labels.ts`](../frontend/lib/external-workforce-labels.ts) → `INTERNAL_ACCOUNTABILITY_LABELS`.

---

## Schema / API identifiers (renamed July 2026)

Legacy `sponsor*` identifiers have been renamed to **responsible manager** vocabulary across schema, migrations, APIs, drift engine, IGA outbox, and tests.

| Canonical | Schema / API / enum | Notes |
|-----------|----------------------|--------|
| Internal accountability reference | `ContractorEngagement.responsibleManagerEmployeeId` | HCM employee id (opaque substrate) |
| Delegate reference | `responsibleManagerDelegateEmployeeId` | Optional |
| Accountability lifecycle | `responsibleManagerStatus`, `ResponsibleManagerAccountabilityStatus` | Engagement state machine |
| HCM validation outcome | `responsibleManagerValidationStatus` | Promote-time gate |
| Missing accountability (drift) | `ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER` | Drift taxonomy |
| Governance remediation event | `EXTERNAL_WORKER_RESPONSIBLE_MANAGER_MISSING` | Downstream integration contract |
| Telemetry field | `missingResponsibleManagerCount` | Dashboard/API |
| Optional CMS inbox | `ResponsibleManagerAccountabilityTask`, `/responsible-manager-tasks` | Feature-flagged |

Code reference map: [`backend/src/domain/governance/internal-accountability.constants.ts`](../backend/src/domain/governance/internal-accountability.constants.ts).

### What engineers should say

| Say | Avoid (in product/docs) |
|-----|-------------------------|
| Internal accountability | "Sponsor means Responsible Manager" |
| Missing internal accountability | Unsponsored worker (user-facing) |
| `responsibleManagerEmployeeId` (when citing code) | Explaining the field as "the sponsor" to customers |

---

## Assessment example (MTN demo)

```text
Worker:     John Smith
Supplier:   Atlas Consulting ✓
Contract:   Active ✓
Responsible Manager: Not assigned ✗

Finding:    No Responsible Manager assigned
Resolution: Assign a Responsible Manager
```

Backend drift row shows type `MISSING_RESPONSIBLE_MANAGER` — operator UI uses Responsible Manager labels only.

---

## IGA boundary (unchanged)

Internal accountability is **published to IGA** as context; IGA owns access certification. See [`business/SPONSOR_ACCOUNTABILITY_MODEL.md`](./business/SPONSOR_ACCOUNTABILITY_MODEL.md) for inbox flag and reference-only doctrine.
