# PR-WORKFORCE-HCM-HISTORY-1 — HCM promote-path workforce history

**Status:** COMPLETE
**Builds on:** [`PR-WORKFORCE-TIMELINE-FOUNDATION-1.md`](./PR-WORKFORCE-TIMELINE-FOUNDATION-1.md), [`../CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md)

## Guardrail

> HCM bootstrap history records **how the contractor entered CMS**; it does **not** make HCM the ongoing workforce authority.

HCM remains a **source/bootstrap** channel. CMS workforce transitions after materialization continue through OPS / supplier nomination paths.

## Scope

When HCM **promote/materialize** succeeds (`PromoteHcmContractorToCmsService`), write `ContractorWorkforceHistory`:

| Field | Value |
|-------|--------|
| `fromState` | `null` |
| `toState` | `ACTIVE` |
| `source` | `HCM_BOOTSTRAP` |
| `effectiveAt` | HCM / engagement `startDate` when present |
| `metadata` | staging id, migration batch id, sync run id, source person ids, engagement id |

Also sets `workforceState = ACTIVE` and derived `isActive` on contractor create/update during promote.

## Write path (same transaction)

```text
Contractor create/update (ACTIVE)
        ↓
Engagement create/update
        ↓
ContractorWorkforceHistory (HCM_BOOTSTRAP)   ← this PR
        ↓
Identity map / staging PROMOTED / migration audit / IGA outbox
```

## Out of scope

- HCM authority model changes
- HCM outbound push
- Backfill for contractors promoted before this PR
- RDS mapping
- `HCM_SYNC` ongoing sync history (reserved)

## Verification

- `promote-hcm-contractor-to-cms.service.spec.ts` — history recorded on success; skipped on dry-run, rejection, tx failure
- `contractor-workforce-history.constants.spec.ts` — metadata builder + label
