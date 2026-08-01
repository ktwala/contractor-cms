# CERT-ENGAGEMENT-ADMINISTRATION

**Capability:** Engagement Administration  
**Certifies conformance to:** [`CAP-ENGAGEMENT-ADMINISTRATION.md`](./CAP-ENGAGEMENT-ADMINISTRATION.md) **v1.0**  
**Status:** TEMPLATE — formal certification gate not yet executed (May 2026)

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
| §3 Boundaries | *Pending* | No workforce/supplier ownership |
| §4 Authoritative objects | *Pending* | — |
| §5 Lifecycle models | *Pending* | Placement, timesheet, invoice |
| §6 Commands | *Pending* | — |
| §7 Policies P-01–P-12 | *Pending* | Sponsor, finance, project container |
| §8 Events | *Pending* | IGA sponsor assigned |
| §9 Read models | *Pending* | Console + sponsor scope |
| §10 Integrations | *Pending* | — |
| §11 Maturity | *Pending* | CAP §11 PR list |
| §12 Invariants (1–12) | *Pending* | E2E recommended |

---

## Recommended evidence sources (when certifying)

| Evidence type | Artifacts |
|---------------|-----------|
| Engagements + sponsor | `engagements.service*.spec.ts`, sponsor governance e2e |
| Nomination + placement | `PR-WORKFORCE-NOMINATE-1`, portal nominate e2e |
| Sponsor inbox | `sponsor-tasks.e2e-spec.ts` |
| Timesheets / invoices | domain e2e suites |
| CAP §11 PR list | As enumerated in CAP-ENGAGEMENT-ADMINISTRATION §11 |

---

## Certification outcome

| Outcome | Date | Notes |
|---------|------|-------|
| *Pending* | — | Execute when Engagement vertical depth gate is scheduled |
