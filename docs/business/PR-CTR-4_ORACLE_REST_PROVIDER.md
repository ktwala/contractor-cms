# PR-CTR-4 — Oracle HCM REST Extract Provider

**Status:** Implemented (staging-only). Admin route: `POST /admin/contractor-migration/batches/oracle-rest`.

## Purpose

Pull contractor rows from Oracle HCM REST into the migration **staging control plane** (`hcm_contractor_staging`). Validation and promotion remain explicit operator steps — the REST provider never writes operational CMS records.

```text
Oracle HCM REST
      ↓
HcmOracleRestExtractProvider (fetch + map)
      ↓
HcmContractorExtractAdapter.ingestOracleRest
      ↓
hcm_contractor_staging
      ↓
POST .../batches/:id/validate   (PR-CTR-2B)
      ↓
POST .../batches/:id/promote    (PR-CTR-5)
```

## Hard rule (governance)

| Allowed on REST ingest | Forbidden on REST ingest |
|------------------------|---------------------------|
| `ContractorMigrationBatch` | `Contractor` |
| `hcm_contractor_staging` | `ContractorEngagement` |
| `contractor_migration_audit` (batch/extract) | `contractor_identity_map` |
| | `ctr_sequence_registry` |
| | `IgaOutboxEvent` / `contractor.migrated` |

Promotion, CTR issuance, identity map, and IGA publishing occur **only** via `PromoteHcmContractorToCmsService` after `validationStatus = PASSED`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HCM_ORACLE_REST_ENABLED` | Yes | Must be `true` to enable the provider |
| `HCM_ORACLE_REST_BASE_URL` | When enabled | Oracle host, e.g. `https://<tenant>.fa.us2.oraclecloud.com` |
| `HCM_ORACLE_REST_WORKERS_PATH` | No | Default `/hcmRestApi/resources/11.13.18.05/workers` |
| `HCM_ORACLE_REST_USERNAME` | No* | Basic auth user |
| `HCM_ORACLE_REST_PASSWORD` | No* | Basic auth password |
| `HCM_ORACLE_REST_BEARER_TOKEN` | No* | Bearer token (overrides Basic if set) |
| `HCM_ORACLE_REST_PAGE_LIMIT` | No | Page size (default 200, max 500) |

\* At least one auth mode (Basic or Bearer) is required for real connectivity.

## Auth modes

1. **Basic** — `HCM_ORACLE_REST_USERNAME` + `HCM_ORACLE_REST_PASSWORD` → `Authorization: Basic …`
2. **Bearer** — `HCM_ORACLE_REST_BEARER_TOKEN` → `Authorization: Bearer …` (takes precedence when set)

Workshop / CI uses **mocked `fetch`** (see PR-CTR-4B e2e) — no live Oracle call.

## Pagination

- Initial request: `{baseUrl}{path}?onlyData=true&limit={pageLimit}`
- Optional cursor: request body/query `since` → `effectiveDate` query param
- Follows Oracle `hasMore` + `links[rel=next]` until exhausted
- Response shape: array or `{ items: [] }` (also `workers`, `records`, `contractors`)

## Field mapping

Oracle / BI rows are flattened to the same workshop JSON shape used by file extract (`person_id`, `sponsor_employee_id`, `vendor_name`, etc.). Raw Oracle object is preserved under `_oracleRest` in `sourcePayloadJson`.

## Failure modes

| Condition | HTTP | Meaning |
|-----------|------|---------|
| `HCM_ORACLE_REST_ENABLED` ≠ `true` | **503** | Provider disabled — use file ingest or enable env |
| Enabled, missing `HCM_ORACLE_REST_BASE_URL` | **400** | Misconfiguration |
| Oracle HTTP non-2xx / network error | **503** | Upstream unavailable |
| Invalid JSON body | **503** | Non-JSON Oracle response |
| Missing `person_id` / `PersonId` on row | **400** | Row mapping error |
| Missing `contractor-migration:manage` | **403** | RBAC |

## Sample admin flow

```bash
# 1) Login (scoped migration manager on DEMO org)
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"finance@ewp.demo","password":"Finance123!"}' \
  | jq -r .accessToken)

# 2) Ingest from Oracle REST (staging only)
INGEST=$(curl -s -X POST http://localhost:3000/api/v1/admin/contractor-migration/batches/oracle-rest \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"waveLabel":"WAVE_ORACLE_1","since":"2024-01-01"}')
BATCH_ID=$(echo "$INGEST" | jq -r .migrationBatchId)

# 3) Validate batch
curl -s -X POST "http://localhost:3000/api/v1/admin/contractor-migration/batches/$BATCH_ID/validate" \
  -H "Authorization: Bearer $TOKEN"

# 4) Review staging / quarantine
curl -s "http://localhost:3000/api/v1/admin/contractor-migration/batches/$BATCH_ID/staging" \
  -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/v1/admin/contractor-migration/batches/$BATCH_ID/quarantine" \
  -H "Authorization: Bearer $TOKEN"

# 5) Promote PASSED rows (controlled path — CTR, identity map, IGA)
curl -s -X POST "http://localhost:3000/api/v1/admin/contractor-migration/batches/$BATCH_ID/promote" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"publishToIga":true}'
```

Global EWP admin (`ops.admin@ewp.demo`) must pass `"organizationId": "<demo-org-uuid>"` on each call.

## Verification

| Test | Location |
|------|----------|
| Unit — provider, mapper, adapter | `backend/src/domain/contractor-migration/**/*.spec.ts` |
| E2E — admin file path | `backend/test/contractor-migration-admin.e2e-spec.ts` |
| E2E — Oracle REST admin (mocked) | `backend/test/contractor-migration-oracle-rest-admin.e2e-spec.ts` |

## Acceptance

PR-CTR-4 exposes Oracle HCM REST as a **staging-only** extract producer. Operators must run validate and promote explicitly; REST ingest cannot bypass governance or write operational CMS records.
