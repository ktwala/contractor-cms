# PR-CTR-2 — Oracle HCM Contractor Migration Staging & Promotion Schema

**Status:** `DRAFT` — schema + migration objects (**PR-CTR-2A/2B**). **No ETL connector** (PR-CTR-3) until promotion contract is signed.

**Upstream:** [`PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md`](./PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md), [`CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md`](./CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md)

**Companion:** [`PR-CTR-2_PROMOTION_RULES.md`](./PR-CTR-2_PROMOTION_RULES.md)

---

## 1. Pipeline (control plane)

```text
Oracle HCM Extract
        ↓
hcm_contractor_staging          (raw + normalized; immutable source_payload)
        ↓
validation + quarantine
        ↓
PromoteHcmContractorToCms()     (sole writer to operational tables)
        ↓
Contractor + ContractorEngagement + contractor_identity_map
        ↓
IGA outbox (post-cutover / PR-CTR-6)
```

**GOV-CTR-1:** No ETL or script may `INSERT`/`UPDATE` `Contractor` directly from HCM payloads.

---

## 2. Migrations

| Migration | Scope |
|-----------|--------|
| `20260518100000_ctr_staging_control_plane` | Enums, batch, staging, quarantine, identity map, audit, CTR sequence |
| `20260518110000_ctr_contractor_extensions` | `Contractor.*` migration columns, `ContractorEngagement.sponsorValidationStatus` |

Apply:

```bash
cd backend && npx prisma migrate deploy
# or Docker:
docker compose exec backend npx prisma migrate deploy
```

---

## 3. Tables

### 3.1 `ContractorMigrationBatch`

Replayable batch header (**GOV-CTR-5**).

| Column | Purpose |
|--------|---------|
| `id` | `migration_batch_id` |
| `organizationId` | Tenant scope |
| `sourceSystem` | `ORACLE_HCM` |
| `waveLabel` | e.g. `WAVE_1_DRY_RUN` |
| `status` | `OPEN` → `PROCESSING` → `COMPLETED` / `FAILED` |
| `statsJson` | Reconciliation counts |

### 3.2 `hcm_contractor_staging`

Raw HCM import — **never overwrite** `sourcePayloadJson`.

| Column | Purpose |
|--------|---------|
| `id` | `staging_id` |
| `migrationBatchId` | Batch FK |
| `sourcePersonId` / `sourcePersonNumber` | HCM keys (reference only) |
| `sourcePayloadJson` | Immutable extract |
| `sourceHash` | Dedup / delta detection |
| `normalizedPayloadJson` | Post-transform (separate from raw) |
| `recordAction` | `INSERT` / `UPDATE` / `DELETE` / `SNAPSHOT` |
| `pipelineStatus` | `EXTRACTED` → … → `IGA_PUBLISHED` |
| `validationStatus` | `PENDING` / `PASSED` / `FAILED` / `QUARANTINED` / `PROMOTED` |
| `validationErrorsJson` | Structured failures |
| `sponsorValidationStatus` | Pre-promote sponsor gate |
| `promotedContractorId` / `issuedContractorBusinessId` | Post-promote linkage |

**Unique:** `(migrationBatchId, sourcePersonId, sourceHash)` — idempotent replay per batch.

### 3.3 `hcm_contractor_quarantine`

Exception queue for rows that cannot auto-promote.

| `reasonCode` | Typical trigger |
|--------------|-----------------|
| `DUPLICATE_IDENTITY` | Email / passport / vendor+name collision |
| `MISSING_SPONSOR` | No sponsor in normalized payload |
| `INACTIVE_SPONSOR` | Sponsor not active in directory |
| `INVALID_DATES` | End before start, impossible ranges |
| `OVERLAPPING_ENGAGEMENT` | Conflicting placements |
| `WORKER_TYPE_MISMATCH` | Employee vs contractor collision |
| `EMPLOYEE_COLLISION` | Same person as internal employee |
| `SUPPLIER_UNRESOLVED` | Vendor crosswalk missing |

Resolution: `resolvedAt` + `overrideReason` (governance record) for controlled promote.

### 3.4 `contractor_identity_map`

HCM → CMS identity transition (**GOV-CTR-3**).

| Column | Rule |
|--------|------|
| `contractorBusinessId` | `CTR-{ORG}-{SEQ}` — **immutable**, unique |
| `legacyHcmPersonId` | Oracle `person_id` — may retire |
| `externalPersonId` | Correlation plane (IGA/HCM) |
| `igaIdentityId` / `adObjectId` | Optional downstream keys |
| `authoritativeSource` | `ORACLE_HCM` or `CMS_NATIVE` after cutover |
| `effectiveFrom` / `effectiveTo` | History without reusing CTR |

### 3.5 `contractor_migration_audit`

Append-only trail: batch, staging, contractor, action, actor.

### 3.6 `ctr_sequence_registry`

Per-organization sequence for `CTR-{orgCode}-{padded}`.

| Column | Purpose |
|--------|---------|
| `orgCode` | From `Organization.code` (e.g. `LSO`) |
| `nextValue` | Monotonic integer |
| `lastIssuedAt` / `lastIssuedTo` | Issuance audit hook |

**Activation:** schema in PR-CTR-2; issuance logic in **PR-CTR-5**.

---

## 4. Operational extensions

### `Contractor` (additive)

| Column | Purpose |
|--------|---------|
| `contractorBusinessId` | `CTR-*` business key |
| `legacySourceSystem` | `ORACLE_HCM` |
| `legacySourcePersonId` | HCM `person_id` |
| `migrationBatchId` | Provenance |
| `migrationStatus` | `NOT_MIGRATED` / `IN_STAGING` / `PROMOTED` / `CMS_NATIVE` |
| `canonicalizationStatus` | `PENDING` / `CANONICAL` / `OVERRIDE` |
| `authoritativeUntil` | Cutover timestamp marker |

Technical PK remains `Contractor.id` (UUID).

### `ContractorEngagement`

| Column | Purpose |
|--------|---------|
| `sponsorValidationStatus` | Last promote-time sponsor validation outcome |

---

## 5. Governance gates (locked)

| ID | Rule |
|----|------|
| **GOV-CTR-1** | No direct staging → operational writes |
| **GOV-CTR-2** | No promotion unless `validationStatus = PASSED` (or documented override) |
| **GOV-CTR-3** | No promoted contractor without `contractorBusinessId` (`CTR-*`) |
| **GOV-CTR-4** | No **new ACTIVE** engagement without `sponsorValidationStatus = VALID` (or override) |
| **GOV-CTR-5** | Every batch replayable via staging + audit |

---

## 6. PR sequence

| PR | Deliverable |
|----|-------------|
| **PR-CTR-2A** | This schema + migrations ✅ |
| **PR-CTR-2B** | `HcmContractorNormalizationService` + `HcmStagingValidationService` + quarantine writer ✅ |
| **PR-CTR-5** | `PromoteHcmContractorToCmsService` + `CtrSequenceService` ✅ |
| **PR-CTR-3** | `HcmContractorExtractAdapter` (file CSV/JSON; REST stub) ✅ |

---

## 7. Workshop gate (before PR-CTR-3)

Validate against sample Oracle HCM extract:

- Contingent worker (happy path)
- Terminated contractor (historical wave)
- Extension (date change delta)
- Sponsor transfer
- Duplicate rehire

Question per row: **“Can this record safely exist in CMS?”**
