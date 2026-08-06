# PR-WORKFORCE-REVIEW-OUTCOMES-1 — Reject, send-back, reopen

**Status:** COMPLETE
**Builds on:** [`PR-WORKFORCE-E2E-UAT-1.md`](./PR-WORKFORCE-E2E-UAT-1.md) baseline

## Guardrail

> Review outcomes close or return a CMS workforce nomination; they do **not** introduce MTN approval workflow, LM/AM chains, SNOW, Aveksa, or `acquisitionModel`.

## Decision

**`REJECTED` is a `workforceState`** — current workforce truth, not a parallel review outcome plane.

Send-back and reopen are **state transitions** on the same contractor record and timeline.

## v1 transition matrix (review outcomes)

```text
NOMINATED        → PENDING_APPROVAL | REJECTED
PENDING_APPROVAL → ACTIVE | NOMINATED | REJECTED
REJECTED         → NOMINATED
```

Reason **required** for:

```text
NOMINATED → REJECTED
PENDING_APPROVAL → REJECTED
PENDING_APPROVAL → NOMINATED   (send back)
REJECTED → NOMINATED           (reopen)
```

## Derived timeline labels

| Transition | Label |
|------------|--------|
| → `REJECTED` | Rejected |
| `PENDING_APPROVAL → NOMINATED` | Returned to supplier |
| `REJECTED → NOMINATED` | Reopened nomination |

## Ops UX

| Surface | Actions |
|---------|---------|
| **Workforce review queue** | Submit for review · Activate · **Reject** · **Send back** |
| **Rejected nominations panel** | **Reopen nomination** |
| **Supplier portal** | Read-only timeline + `Rejected` badge (records stay in list) |

## Portal visibility

- Suppliers **see** `REJECTED` contractors and timeline
- Portal-safe **reasons** on reject, send-back, reopen only
- Suppliers **cannot** transition workforce state

## API

| Method | Path | Purpose |
|--------|------|---------|
| `PATCH` | `/contractors/:id/workforce-transition` | All outcomes (reason enforced server-side) |
| `GET` | `/contractors/workforce-rejected` | Rejected registry panel (not review queue) |

## Domain stubs

- `ContractorRejected`
- `ContractorNominationReopened`
- Send-back reuses `ContractorNominated` integration stub

## Verification

- `contractor-workforce-review-outcomes.spec.ts`
- `workforce-administration-uat.e2e-spec.ts` unhappy-path test

## Out of scope

- MTN RDS mapping
- Blacklist (next safe branch)
- Acquisition model / independent contractors

## Next

**Blacklist** — [`PR-WORKFORCE-BLACKLIST-1.md`](./PR-WORKFORCE-BLACKLIST-1.md) **COMPLETE**; RDS mapping with full workforce plane paths.
