# PR-ACCESS-INTEGRATION-WORKFORCE-REACTIONS-1 — Workforce event reactions

**Status:** COMPLETE
**Capability:** Access Integration
**CAP version:** v1.0

## CAP traceability

| Field | Value |
|-------|-------|
| **Capability** | Access Integration |
| **CAP version** | v1.0 |
| **Implements** | CAP §8 (react to Worker Suspended) · §10.1 (consume workforce facts) · §12 inv. 1–4, 6–8 |
| **Contract change?** | No |

## Problem

Workforce transitions emitted domain event stubs but Access Integration did not consume them — violating CAP §10.1 and leaving Workforce CERT §10 PARTIAL.

## Approach

```text
Workforce applyTransition
        ↓
ContractorWorkforceEventPublisherService (audit stub)
        ↓
AccessIntegrationWorkforceReactionService (read contractor — no mutation)
        ↓
AccessIntegrationPublishService → IGA outbox
```

| Workforce domain event | IGA outbox intent |
|------------------------|-------------------|
| Worker Suspended | `EXTERNAL_PERSON_SUSPENDED` |
| Worker Terminated | `EXTERNAL_PERSON_TERMINATED` |
| Worker Blacklisted | `EXTERNAL_PERSON_TERMINATED` *(revoke)* |
| Worker Activated / Reinstated / Rehired | `EXTERNAL_PERSON_UPDATED` *(restore)* |

**Guardrail:** Access Integration publishes intent only. It does not change workforce state or execute IGA provisioning.

## Code

| Area | Path |
|------|------|
| Reaction service | `access-integration-workforce-reaction.service.ts` |
| Intent mapping | `workforce-access-intent.constants.ts` |
| Publish methods | `access-integration-publish.service.ts` |
| Workforce hook | `contractor-workforce-state.service.ts` |
| IGA builders | `iga-event.builder.ts` · `iga-workforce-event-writer.service.ts` |

## Out of scope

- IGA ack ingestion
- ServiceNow / Aveksa execution
- Access status ownership
- Manual access UI

## Verification

```bash
cd backend && npm run test:unit -- --testPathPatterns='access-integration|contractor-workforce-state'
```

## CERT

Re-run: [`CERT-ACCESS-INTEGRATION.md`](./capabilities/CERT-ACCESS-INTEGRATION.md) — workforce reactions **PASS** §10.
