# External Workforce Canonical Data Model v1

> **Product:** External Workforce Platform (EWP). Renamed from *CMS Contractor Canonical Data Model* per [`ADR-012`](./ADR-012-External-Workforce-Platform-Naming.md). Logical `contractor_*` table names reflect current schema identifiers.

**Status:** `DRAFT` — companion to [`PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md`](./PR-CTR-1_ORACLE_HCM_MIGRATION_CONSTITUTION.md).

**Purpose:** Canonical schema intent, Oracle HCM field mapping, migration rules, and sponsor governance **before** ETL or promote APIs.

---

## 1. Logical model (target)

```text
contractor_staging_hcm          ← raw HCM import (append-only per batch)
        ↓ validate
contractor_registry             ← canonical operational contractor (≈ Contractor + extensions)
contractor_sponsor_link         ← placement-level sponsor (≈ ContractorEngagement sponsor fields)
contractor_identity_map         ← cross-system IDs (HCM, AD, IGA, CTR ref)
contractor_lifecycle_audit      ← state transitions + provenance
```

**Repo today (partial implementation):**

| Logical | Current Prisma |
|---------|----------------|
| `contractor_registry` | `Contractor` |
| `contractor_sponsor_link` | `ContractorEngagement.sponsorEmployeeId`, `sponsorDelegateEmployeeId`, `sponsorStatus` |
| `contractor_identity_map` | `Contractor.externalPersonId` (+ future `ContractorIdentityMap` table) |
| `contractor_staging_hcm` | **Not yet** — PR-CTR-2 candidate |
| `contractor_lifecycle_audit` | `AuditLog` / domain events — extend for migration provenance |

---

## 2. Canonical contractor record (registry)

### 2.1 Business keys

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `canonical_contractor_ref` | string | Yes (post-promote) | `CTR-{ORG}-{SEQ}` — immutable |
| `id` | uuid | Yes | Technical PK (existing `Contractor.id`) |
| `source_system` | enum | Yes | `ORACLE_HCM` \| `CMS_NATIVE` \| … |
| `migration_batch_id` | uuid | If imported | Tie-break for replay / rollback |
| `legacy_hcm_person_id` | string | If HCM | Oracle `person_id` |
| `legacy_hcm_person_number` | string | If HCM | Oracle `person_number` — **reference only** |

### 2.2 Person & identity

| Field | Type | HCM source | CMS today |
|-------|------|------------|-----------|
| `first_name` | string | `first_name` | `Contractor.firstName` |
| `last_name` | string | `last_name` | `Contractor.lastName` |
| `email` | string | `email` | `Contractor.email` |
| `phone` | string | `phone` | `Contractor.phone` |
| `national_id` | string | `national_id` | `Contractor.idNumber` |
| `passport_number` | string | `passport` | `Contractor.passportNumber` |
| `date_of_birth` | date | `date_of_birth` | `Contractor.dateOfBirth` |
| `country` | string | `country` | `Contractor.taxResidency` (align or split) |
| `employment_class` | enum | `contractor_type` | `Contractor.workerClassification` |
| `person_type` | enum | derived | `Contractor.personType` |
| `external_person_id` | string | map from HCM | `Contractor.externalPersonId` |

### 2.3 Supplier & commercial

| Field | Type | HCM source | CMS today |
|-------|------|------------|-----------|
| `supplier_id` | uuid | `vendor` / supplier correlation | `Contractor.supplierId` |
| `supplier_resource_id` | string | supplier worker id | `Contractor.supplierResourceId` |

**Rule:** Supplier must exist in CMS `Supplier` before promote; HCM vendor code → CMS supplier mapping table (PR-CTR-3).

### 2.4 Lifecycle & access intent

| Field | Type | HCM source | CMS today |
|-------|------|------------|-----------|
| `lifecycle_state` | enum | derived from HCM status + dates | `Contractor.isActive` + engagement dates |
| `identity_status` | enum | derived | `Contractor.igaIntegrationStatus` (plane separation) |
| `access_intent` | enum | derived / policy | `Contractor.accessIntent` |
| `effective_start` | date | `start_date` | `ContractorEngagement.startDate` |
| `effective_end` | date | `end_date` | `ContractorEngagement.endDate` |
| `authoritative_until` | timestamptz | cutover marker | **New** — when CMS became write master |

### 2.5 Organization context (placement)

| Field | Type | HCM source | CMS today |
|-------|------|------------|-----------|
| `business_unit` | string | `business_unit` | **Gap** — `Project` / org attrs |
| `department` | string | `department` | **Gap** |
| `manager_employee_id` | string | `manager` | **Gap** (distinct from sponsor) |
| `cost_center` | string | `cost_center` | `ContractorEngagement.costCenterId` |
| `location` | string | `location` | **Gap** |

### 2.6 EXTID / IGA substrate (existing)

| Field | CMS column |
|-------|------------|
| `access_intent` | `accessIntent` |
| `identity_required` | `identityRequired` |
| `physical_access_required` | `physicalAccessRequired` |
| `logical_access_required` | `logicalAccessRequired` |
| `iga_integration_status` | `igaIntegrationStatus` |
| `access_enablement_status` | `accessEnablementStatus` |
| `risk_tier` | `riskTier` |
| `worker_archetype` | `workerArchetype` |

---

## 3. Sponsor model (placement-level)

Canonical sponsor data lives on **engagement**, not contractor root (aligned with repo + [`SPONSOR_ACCOUNTABILITY_MODEL.md`](./SPONSOR_ACCOUNTABILITY_MODEL.md)).

| Field | Type | HCM source | CMS today |
|-------|------|------------|-----------|
| `sponsor_person_id` | string (HCM emp ref) | `sponsor` | `ContractorEngagement.sponsorEmployeeId` |
| `sponsor_delegate_person_id` | string | optional | `sponsorDelegateEmployeeId` |
| `sponsor_status` | enum | derived | `sponsorStatus` |

### Migration rules

| Rule | Behavior |
|------|----------|
| HCM sponsor blank | **Quarantine** — do not promote to ACTIVE |
| HCM sponsor unknown | Quarantine; optional stub validation via `HCM_SPONSOR_VALIDATION_ENABLED` |
| Sponsor inactive in directory | Exception queue; default deny promote |
| Multiple concurrent sponsors | Primary on engagement; delegates explicit only |
| Post-cutover sponsor change | CMS update → `contractor.sponsor_changed` IGA event |

**CMS inbox flag:** `SPONSOR_ACCOUNTABILITY_INBOX_ENABLED` affects UI row scope only; **not** migration promote rules.

---

## 4. Oracle HCM → CMS mapping (minimum v1)

| Oracle HCM | CMS target | Transform |
|------------|------------|-----------|
| `person_id` | `legacy_hcm_person_id` / `external_person_id` | Store both; do not use as PK |
| `person_number` | `legacy_hcm_person_number` | Display / search only |
| `contractor_type` | `employment_class` / `person_type` | Enum map table |
| `vendor_id` | `supplier_id` | Via supplier crosswalk |
| `first_name`, `last_name` | person names | Trim, normalize case |
| `email` | `email` | Lowercase; duplicate check |
| `national_id` / `passport` | id fields | Hash for dedup optional |
| `business_unit`, `department` | org context | Staging JSON until columns added |
| `manager` | `manager_employee_id` | HCM employee ref |
| `sponsor` | `sponsor_person_id` | Required for promote |
| `start_date`, `end_date` | engagement dates | TZ = org default |
| `status` | `lifecycle_state` | Map table (see §5) |
| `country`, `location` | residency / location | ISO country codes |
| `cost_center` | `cost_center` | String or FK when master exists |

---

## 5. Lifecycle state mapping (illustrative)

| HCM status (examples) | CMS `lifecycle_state` | Promote? |
|-----------------------|----------------------|----------|
| Active | `ACTIVE` | Yes, if sponsor valid |
| Terminated / Inactive | `TERMINATED` / `INACTIVE` | Wave 1 historical only |
| Pending | `PENDING_ONBOARDING` | Staging until sponsor + supplier OK |
| Unknown | `UNKNOWN` | Quarantine |

**Engagement rule:** Contractor without at least one engagement row is **incomplete** — auto-create skeleton engagement on promote if HCM provides placement dates.

---

## 6. Staging table design (PR-CTR-2 candidate)

### `contractor_staging_hcm`

| Column | Purpose |
|--------|---------|
| `id` | Staging row uuid |
| `migration_batch_id` | Batch correlation |
| `raw_payload` | jsonb — full HCM row |
| `normalized_payload` | jsonb — post-transform |
| `validation_status` | `PENDING` \| `VALID` \| `QUARANTINE` \| `PROMOTED` |
| `validation_errors` | jsonb array |
| `legacy_hcm_person_id` | indexed |
| `email` | indexed for dedup |
| `promoted_contractor_id` | uuid nullable |
| `promoted_at` | timestamptz |

### `contractor_identity_map` (PR-CTR-2 candidate)

| Column | Purpose |
|--------|---------|
| `contractor_id` | FK → Contractor |
| `system` | `ORACLE_HCM` \| `ACTIVE_DIRECTORY` \| `IGA` |
| `external_id` | system-native key |
| `is_primary` | boolean |
| `effective_from` / `effective_to` | validity window |

---

## 7. Migration execution rules

### Promote (staging → registry)

```text
1. Resolve supplier crosswalk
2. Run duplicate detection (email, passport, vendor+name)
3. Validate sponsor + lifecycle
4. Issue canonical_contractor_ref (CTR-*)
5. Upsert Contractor + ContractorEngagement
6. Write contractor_identity_map rows
7. Append contractor_lifecycle_audit
8. Mark staging row PROMOTED
```

### Dry-run

- Steps 1–3 only; emit reconciliation report; **no** CTR issuance; **no** IGA publish.

### IGA publish

- **Off** during Wave 1 dry-run  
- **On** after Wave 2 cutover for promoted rows and net-new CMS creates  

---

## 8. Duplicate detection (minimum)

| Key | Action |
|-----|--------|
| Same email (active) | Quarantine; link if same person proof |
| Same passport / national id | Quarantine |
| Same vendor + normalized name | Review queue |
| Same sponsor + overlapping dates | Review queue |

---

## 9. Cutover runbook checklist

- [ ] Wave 1 reconciliation signed (counts, quarantine %, sponsor gaps)  
- [ ] Supplier crosswalk complete  
- [ ] CTR sequence generator tested (no collisions)  
- [ ] HCM freeze communicated and enforced  
- [ ] Final delta batch id recorded  
- [ ] `authoritative_until` set on all promoted rows  
- [ ] IGA outbox smoke on `contractor.created` / `sponsor_changed`  
- [ ] Rollback plan: staging replay only; **never** reuse CTR numbers  

---

## 10. Current repo gap summary

| Capability | State |
|------------|--------|
| Contractor + engagement core | **Implemented** |
| Sponsor on engagement | **Implemented** |
| EXTID / IGA substrate columns | **Partially implemented** (`schema.prisma`) |
| HCM sponsor validation stub | **Optional flag** |
| IGA outbox sponsor fields | **Implemented** (enrichment deferred) |
| `hcm_contractor_staging` | **Schema** — PR-CTR-2A (`20260518100000`) |
| `contractor_identity_map` / `ctr_sequence_registry` | **Schema** — PR-CTR-2A |
| `CTR-*` business ref | **Schema** on `Contractor.contractorBusinessId`; issuance **PR-CTR-5** |
| HCM REST / file ingest | **Not started** (PR-CTR-3) |
| CMS write authority flip | **Process** — PR-CTR-6 |

---

## 11. Next engineering step

After review of this model + PR-CTR-1:

1. Update [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md) with CTR + staging candidates.  
2. Open **PR-CTR-2** design PR (staging + identity map tables only — additive).  
3. Do **not** build ETL until promote rules in §7 are signed.
