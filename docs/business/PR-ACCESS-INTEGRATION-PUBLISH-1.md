# PR-ACCESS-INTEGRATION-PUBLISH-1 — Gateway publish boundary

**Status:** COMPLETE  
**Capability:** Access Integration  
**CAP version:** v1.0

## CAP traceability

| Field | Value |
|-------|-------|
| **Capability** | Access Integration |
| **CAP version** | v1.0 |
| **Implements** | CAP §3.1 publish boundary · §6 Publish to IGA · §10.2 handover to IGA · §12 inv. 1–3 |
| **Contract change?** | No |

## Problem

IGA outbox enqueue was scattered across Identity Acquisition (promote), Workforce (create/nominate), and Engagement (sponsor) paths — violating the gateway ownership law: **Access Integration ends at publish to IGA.**

## Approach

Introduce `AccessIntegrationModule` and `AccessIntegrationPublishService` as the **single gateway** for all IGA intent enqueue operations.

| Before | After |
|--------|-------|
| `PromoteHcmContractorToCmsService` → `IgaOutboxService.save` | → `publishAcquisitionMigratedIntent` |
| `ContractorsService` → `IgaWorkforceEventWriter` | → `publishExternalPersonCreated/Updated` |
| `EngagementsService` → `IgaWorkforceEventWriter` | → `publishSponsorAssigned` |

Identity Acquisition promote **still** triggers publish after canonical handoff — but transport is owned by Access Integration (CAP-IDENTITY §10.2 → CAP-ACCESS §10.1).

## Code

| Area | Path |
|------|------|
| Gateway module | `backend/src/domain/access-integration/` |
| Acquisition migrated intent | `types/acquisition-migrated-intent.types.ts` |
| Promote wiring | `promote-hcm-contractor-to-cms.service.ts` |
| Workforce / engagement wiring | `contractors.service.ts`, `engagements.service.ts` |

## Out of scope

- Workforce event reactions (suspend → revoke intent)
- Publish pipeline read models
- CERT-ACCESS-INTEGRATION execution
- Moving `IgaOutboxDispatcherService` into domain module (transport infra stays in `core/iga`)

## Verification

```bash
cd backend && npm run test:unit -- --testPathPatterns='access-integration|promote-hcm|contractors.service.iga|engagements.service.iga'
```
