# CERT-SUPPLIER-ADMINISTRATION

**Capability:** Supplier Administration
**Certifies conformance to:** [`CAP-SUPPLIER-ADMINISTRATION.md`](./CAP-SUPPLIER-ADMINISTRATION.md) **v1.0**
**Status:** TEMPLATE — formal certification gate not yet executed (May 2026)
**Purpose:** Prove implementation **upholds the CAP** — not that a specific stack was used.

> CERT answers: *Does the implementation satisfy the capability contract?*
> PR answers: *What changed in this increment?*

---

## Certification scope

| Field | Value |
|-------|-------|
| CAP version | 1.0 |
| Platform | External Workforce Platform (EWP) |
| Implementation | `contractor-cms` backend + frontend (current) |
| Certification date | *Pending* |
| Certified by | *Pending* |

---

## Section conformance

| CAP section | Result | Notes / evidence |
|-------------|--------|------------------|
| §1 Purpose | *Pending* | — |
| §2 Business question | *Pending* | — |
| §3 Boundaries | *Pending* | No workforce / engagement ownership |
| §4 Authoritative objects | *Pending* | — |
| §5 State machine | *Pending* | Six statuses + rejection path |
| §6 Commands | *Pending* | Status endpoint + evidence commands |
| §7 Policies P-01–P-10 | *Pending* | Evidence gate, self-approval, authority |
| §7 Policy P-11 | *Pending* | Independent path — **Planned** |
| §8 Events | *Pending* | Audit catalog |
| §9 Read models | *Pending* | Registry, queue, portal, overview health |
| §10 Integrations | *Pending* | Connector import + workforce scope |
| §11 Maturity | *Pending* | PR evidence in CAP §11 |
| §12 Invariants (1–12) | *Pending* | Lifecycle + evidence e2e specs recommended |

**Result legend:** `PASS` | `PARTIAL` | `FAIL` | `Pending`

---

## Recommended evidence sources (when certifying)

| Evidence type | Artifacts |
|---------------|-----------|
| Lifecycle | `supplier-lifecycle*.spec.ts`, `supplier-lifecycle.e2e-spec.ts` |
| Evidence | `supplier-evidence*.spec.ts`, `supplier-jurisdiction-evidence.e2e-spec.ts` |
| Approvals | `supplier-approvals.e2e-spec.ts` |
| Portal | `supplier-portal*.e2e-spec.ts` |
| CAP §11 PR list | As enumerated in CAP-SUPPLIER-ADMINISTRATION §11 |

---

## Certification outcome

| Outcome | Date | Notes |
|---------|------|-------|
| *Pending* | — | Execute when Supplier Administration vertical depth gate is scheduled |

When executed, update this document and link from [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](../EXTERNAL_WORKFORCE_CAPABILITY_MAP.md).
