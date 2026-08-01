# PR-NAV-CAPABILITY-IA-2 — Navigation freeze

**Status:** **FROZEN** (May 2026) — part of [`EWP-V1-ARCHITECTURE-FREEZE.md`](./EWP-V1-ARCHITECTURE-FREEZE.md)  
**Authority:** [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](./EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) · [`EXTERNAL_WORKFORCE_VOCABULARY.md`](./EXTERNAL_WORKFORCE_VOCABULARY.md)  
**Implementation:** [`frontend/lib/protected-routes.ts`](../../frontend/lib/protected-routes.ts) · [`frontend/lib/external-workforce-labels.ts`](../../frontend/lib/external-workforce-labels.ts)

---

## Purpose

The sidebar is **business capability navigation**, not system module navigation. It teaches the External Workforce Platform domain by structure alone.

---

## Frozen top-level structure

| Section | Nav items (permission-gated) |
|---------|--------------------------------|
| *(no heading)* | **Overview** (`/dashboard`) |
| **Supplier Administration** | Suppliers · Supplier sync* · Supplier approvals |
| **Workforce Administration** | External Workers · Workforce review · Identity Acquisition* |
| **Engagement Administration** | Contracts · Engagements · Timesheets · Invoices · Projects · Sponsor Accountability† |
| **Governance** | Audit Logs · Governance Status · Exceptions · Security Insights |
| **Administration** | Users · Roles |
| **Supplier portal** *(external shell only)* | Supplier profile · External workers · Supplier timesheets · Supplier invoices |

\* Connector-gated (`requiresOracleConnector` / `requiresHcmConnector`).  
† Sponsor Accountability requires sponsor accountability inbox flag.

---

## Overview page

The `/dashboard` route renders a **capability health page** — each section shows **Healthy** or **Attention** based on actionable backlog. Detailed analytics charts remain below for roles with `analytics:read`.

---

## Placement decisions

### Overview (not Dashboard)

The landing route remains `/dashboard` for stability. The **label** is **Overview** — a capability projection of the platform, not a flat widget dashboard.

### Sponsor Accountability (not Sponsor tasks)

Matches sponsor accountability doctrine — an accountability object, not a generic task list label.

### Identity Acquisition (not Contractor bootstrap)

Matches the **Identity Acquisition** capability in the capability map. Source-agnostic: Oracle HCM today; Workday, SAP, CSV, or API paths later without nav churn.

### Projects under Engagement Administration

**Kept** — validated against the domain model:

- Engagements and timesheets are **project-scoped** (assignment container).
- Projects track budget utilization **for external worker delivery**, not standalone programme management.
- If Projects later grows into a separate delivery bounded context, that requires a **capability architecture decision** before moving nav.

---

## Governance rules (mirror CAP discipline)

**Navigation SHALL reflect the Capability Map.**

- Do not reorganize the sidebar for shortcuts or feature growth.
- Do not add a new top-level section without a capability architecture decision.
- Change navigation only when the capability map changes.

| Change | Rule |
|--------|------|
| New page / screen | Add under an **existing** capability section unless a new capability is approved |
| New capability | Capability map + CAP + ADR — same bar as backend architecture |
| Rename nav section | ADR or vocabulary amendment — sidebar is frozen |
| URL path | May stay implementation-stable (`/contractors`, `/dashboard`) independent of labels |

> **CAP changes before capability behaviour changes. Capability changes before navigation changes.**

> **New implementation → existing CAP. New page → existing capability. New capability → capability architecture decision.**

When proposing work, answer:

1. Which capability does this belong to?
2. Does it require a new page?
3. If yes, place it under the existing capability.
4. If it needs a new top-level section, change the Capability Map first — not the sidebar.

---

## Future (not in scope for freeze)

**Capability landing pages** — e.g. click *Supplier Administration* → hub with Suppliers, Approvals, Sync — reinforce the model further. Deferred; current flat capability sections are sufficient for v1.

---

## Change log

| Date | Change |
|------|--------|
| 2026-05 | PR-NAV-CAPABILITY-IA-1 — Operations → capability sections |
| 2026-05 | PR-NAV-CAPABILITY-IA-2 — Overview, Identity Acquisition, freeze + Projects rationale |
| 2026-05 | PR-NAV-CAPABILITY-IA-3 — Sponsor Accountability label; capability-aligned Overview page |
