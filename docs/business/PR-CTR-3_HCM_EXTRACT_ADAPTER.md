# PR-CTR-3 — HCM Extract Adapter (staging only)

**Status:** `DRAFT` — file extract enabled; Oracle REST via PR-CTR-4 (staging-only, see `PR-CTR-4_ORACLE_REST_PROVIDER.md`).

## Pipeline

```text
Oracle HCM / file extract
        ↓
HcmContractorExtractAdapter
        ↓
hcm_contractor_staging
        ↓
PR-CTR-2B validation
        ↓
PR-CTR-5 promotion
```

## Hard rule

PR-CTR-3 **must not** write `Contractor`, `ContractorEngagement`, `contractor_identity_map`, `ctr_sequence_registry`, or IGA outbox.

## Components

| Component | Role |
|-----------|------|
| `HcmContractorExtractAdapter` | Orchestrates file / REST ingest |
| `HcmContractorFileExtractParser` | CSV / JSON → `HcmExtractRecord[]` |
| `HcmContractorStagingWriterService` | Batch + staging rows + audit |
| `HcmOracleRestExtractProvider` | Oracle REST fetch (disabled unless `HCM_ORACLE_REST_ENABLED=true`) |

## Gates

| Gate | Behavior |
|------|----------|
| Same `source_hash` in batch | Skip (counted in `skippedDuplicateHash`) |
| Same `source_person_id`, new payload | New staging row (new hash) |
| Raw payload | Stored immutable in `sourcePayloadJson` |
| Validation | Left `PENDING` — no bypass |
| Promotion | Not invoked by adapter |

## Workshop runner

```bash
# Dry-run (parse + hash only)
./scripts/run-hcm-migration-workshop.sh

# Persist staging + validate
DRY_RUN=false ./scripts/run-hcm-migration-workshop.sh

# Full pipeline: ingest → validate → promote PASSED rows
DRY_RUN=false PROMOTE=true ./scripts/run-hcm-migration-workshop.sh
```

Requires `ORG_CODE=DEMO` (default), demo supplier **Demo Supplier Ltd**, and an active supplier contract in that org.

E2E: `backend/test/hcm-migration-pipeline.e2e-spec.ts`

## File workshop usage

```typescript
const summary = await extractAdapter.ingestFile({
  organizationId: '<org-uuid>',
  format: 'json', // or 'csv'
  fileName: 'hcm-sample.json',
  content: fs.readFileSync('samples/hcm-contractors.json', 'utf8'),
  waveLabel: 'WORKSHOP_WAVE_1',
  dryRun: true, // set false to persist staging
});
```

Then per staging row:

```typescript
await validationService.validate({ stagingId, organizationId });
// if PASSED:
await promoteService.execute(stagingId, { publishToIga: false });
```

## Acceptance

PR-CTR-3 imports Oracle HCM contractor extract records into `hcm_contractor_staging` with batch traceability, source payload preservation, deduplication, and dry-run support, without mutating operational CMS contractor records or bypassing validation and promotion controls.
