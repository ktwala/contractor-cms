# PR-CTR-CONNECTOR-1G — Governance remediation workflows

## Objective

Evolve from **detecting governance risk** to **orchestrating governance response** without automatic identity mutation.

## Doctrine

| Layer | Role |
|-------|------|
| Drift registry | Authoritative risk signal |
| Remediation workflow | Human + orchestrated response |
| PDP cascade | Runtime restriction (no deactivation) |

**Drift detection identifies risk. Remediation orchestrates response. Neither implies automatic mutation.**

## Flagship scenario

```text
HCM terminated + contractor.isActive = true
→ GOVERNANCE_LIFECYCLE_CONFLICT (CRITICAL)
→ ContractorGovernanceRemediation (OPEN, PDP_RESTRICTION)
→ PDP blocks SUBMIT_TIMESHEET, CREATE_CONTRACTOR, SUBMIT_INVOICE
→ Access review / governance owner workflow
→ ACKNOWLEDGED → REMEDIATION_IN_PROGRESS → VERIFIED → CLOSED
→ PDP restrictions lifted; contractor record unchanged unless human action
```

## Remediation model

`ContractorGovernanceRemediation` — separate lifecycle from drift:

`OPEN` → `ACKNOWLEDGED` → `REMEDIATION_IN_PROGRESS` → `VERIFIED` → `CLOSED`

### Initial remediation types

| Type | Meaning |
|------|---------|
| `PDP_RESTRICTION` | Runtime limitation |
| `ACCESS_REVIEW_REQUIRED` | Governance review |
| `CORRELATION_REVIEW` | Identity review |
| `SUPPLIER_LINK_REPAIR` | Vendor remediation |
| `TERMINATION_VALIDATION` | HR verification |

## Governance event contract (audit only)

`GovernanceRemediationEvent` emitted on create — e.g. `CONTRACTOR_GOVERNANCE_LIFECYCLE_CONFLICT` for downstream consumers (Soffid, AD, PAM, access review). **No auto-revocation in 1G.**

## API

| Method | Path | Permission |
|--------|------|------------|
| POST | `/contractor-governance/remediation/create` | `contractor-migration:manage` |
| GET | `/contractor-governance/remediation` | `contractor-migration:read` |
| GET | `/contractor-governance/remediation/summary` | `contractor-migration:read` |
| POST | `/contractor-governance/remediation/:id/acknowledge` | `contractor-migration:manage` |
| POST | `/contractor-governance/remediation/:id/verify` | `contractor-migration:manage` |
| POST | `/contractor-governance/remediation/:id/close` | `contractor-migration:manage` |

Auto-create: after `POST .../drift/detect` and post-HCM sync via orchestrator.

## PDP cascade

`WorkforceGovernanceRuleEvaluator` — `WORKFORCE_GOVERNANCE_RESTRICTED` when active remediation has `pdpRestrictionsApplied: true` and status ≠ `CLOSED`.

## UI

`/contractor-sources/oracle-hcm/operations` — **Governance remediation queue** with summary tiles and remediation table.

## Tests

- `workforce-governance.rule.spec.ts`
- `contractor-governance-remediation.e2e-spec.ts`

## Explicitly out of scope (1G)

- Automatic disablement / deletion
- Soffid auto-revocation
- Self-healing identity merges

## Platform maturity after 1G

Governed supplier fabric + governed workforce fabric + operational drift governance + **governance remediation orchestration**.

## See also

- [CONNECTOR_GOVERNANCE_PLATFORM.md](../CONNECTOR_GOVERNANCE_PLATFORM.md) — full platform reference
- [CONNECTOR_DEMO_UAT.md](../CONNECTOR_DEMO_UAT.md) — repeatable demo script
