# Business sponsor accountability model

> **Product vocabulary (2026):** The platform concept is [**Internal Accountability**](../INTERNAL_ACCOUNTABILITY_MODEL.md). MTN displays **Responsible Manager**. This document describes the **legacy implementation** (`sponsorEmployeeId`, optional CMS inbox, IGA bridge) — still accurate for code and integrations.

**PR-SPONSOR-DOCTRINE-REALIGN-1** · **PR-SPONSOR-REFERENCE-ONLY-1**

## Doctrine (Option A — default)

A **business sponsor** is an **internal client employee** (HCM reference) accountable for a contractor placement. CMS stores the reference and publishes context; **IGA/workflow** owns approvals and certification.

```text
Sponsor = internal employee reference (HCM)
CMS     = sponsorEmployeeId + publish to IGA outbox
IGA     = access approval, certification, access decisions
```

Sponsors **do not** log into CMS by default.

Not:

```text
Sponsor = dedicated CMS portal persona with inbox and row-scoped lists
```

## Data retained (always)

| Field / capability | Purpose |
|--------------------|---------|
| `ContractorEngagement.sponsorEmployeeId` | Accountability owner (HCM ref) |
| `sponsorDelegateEmployeeId` | Optional delegate |
| `sponsorStatus` | CMS lifecycle state on engagement |
| HCM sponsor reference validation | Optional format/existence checks |
| IGA outbox sponsor fields/events | Downstream access workflow |
| Client manager/admin assign sponsor | Engagement maintenance |

## Optional CMS inbox (legacy Option B)

When `SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true` (default **off**):

- `AccessContext.sponsorEmployeeId` row scope on contractors/engagements
- `/api/v1/sponsor-tasks` and `/sponsor-tasks` UI
- Sidebar labels: **Sponsored contractors**, **My sponsored engagements**, **My sponsor tasks**
- Demo user `sponsor@ewp.demo` seeded only when flag is true at seed time

```bash
# Enable demo inbox locally
SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true docker compose exec backend npm run db:seed
```

Profile exposes `sponsorAccountabilityInboxEnabled` for the frontend.

## Production identity

| Concern | Source |
|--------|--------|
| Person identity | HCM → stored on engagement as `sponsorEmployeeId` (not required to be a CMS user) |
| Accountability link | `ContractorEngagement.sponsorEmployeeId` (+ delegate) |
| CMS row scope | Only when inbox flag is **on** and internal user has `externalId` + sponsor reads |
| Role name `SPONSOR` | Demo seed only when inbox flag is on |

## Demo / test scaffolding

`sponsor@ewp.demo` exists **only** when both:

1. `SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true` on backend at runtime, and
2. Same flag when running `npm run db:seed`

`User.externalId` = `ewp:emp:responsible-manager-demo` matches demo engagement `sponsorEmployeeId`.

## Validation scripts

```bash
export SPONSOR_ACCOUNTABILITY_INBOX_ENABLED=true
API_BASE=http://localhost:3000/api/v1 ./scripts/validate-sponsor-scope.sh
API_BASE=http://localhost:3000/api/v1 ./scripts/validate-sponsor-tasks.sh
```

E2E:

- `backend/test/sponsor-scope-isolation.e2e-spec.ts` (inbox on)
- `backend/test/sponsor-tasks.e2e-spec.ts` (inbox on)
- `backend/test/sponsor-reference-only.e2e-spec.ts` (inbox off — default doctrine)

## Related PRs

- PR-SPONSOR-REFERENCE-ONLY-1 — feature flag, default reference-only
- PR-SPONSOR-DOCTRINE-REALIGN-1 — doctrine and UI labels
- PR-SPONSOR-SCOPE-VALIDATION-1 — row isolation (inbox on)
- PR-SPONSOR-TASKS-1 — accountability task inbox (inbox on)
- PR-HCM-SPONSOR-BRIDGE-1 — optional HCM reference validation
