# PR-GOV-SIGNAL-LIFECYCLE-1 — Governance signal lifecycle (foundation)

**Status:** COMPLETE (contractor workforce drifts — foundation)

## Objective

Prevent migration-era drift from permanently polluting operational governance surfaces.

## Deliverables (v1)

| Item | Location |
|------|----------|
| Design | [`../GOVERNANCE_SIGNAL_LIFECYCLE.md`](../GOVERNANCE_SIGNAL_LIFECYCLE.md) |
| Schema | `Organization.workforceMigrationCutoverAt`, `ContractorSourceDrift` lifecycle columns |
| Classification | `governance-signal-lifecycle.constants.ts` |
| Visibility | `governance-signal-lifecycle.util.ts` |
| Detection | `contractor-source-drift-detection.service.ts` |
| List/summary filter | `contractor-source-drift.service.ts` |
| Auto-archive expired bootstrap | end of `detectForOrganization` |

## Acceptance

| Rule | Enforcement |
|------|-------------|
| `UNSPONSORED_CONTRACTOR` is `OPERATIONAL` | constants + unit test |
| Correlation/duplicate/checkpoint drifts are `BOOTSTRAP` | constants |
| Past cutover + `operationalOnly` hides suppressed bootstrap | list/summary where |
| Expired bootstrap drifts archived on scan | detection service |

## Next

- Supplier drift parity
- Org admin API to set `workforceMigrationCutoverAt`
- Dashboard “migration vs operational” toggle in UI

## Related

- PR-CTR-CONNECTOR-1F — drift engine
- [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md)
