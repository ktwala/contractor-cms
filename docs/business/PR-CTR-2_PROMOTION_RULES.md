# PR-CTR-2 — Promotion Rules & Service Contract

**Status:** `DRAFT` — **PR-CTR-2C** application contract. Implements governance gates from [`PR-CTR-2_STAGING_SCHEMA.md`](./PR-CTR-2_STAGING_SCHEMA.md).

**Code anchor:** `backend/src/domain/contractor-migration/contracts/`

---

## 1. Sole promotion entry point

```text
PromoteHcmContractorToCms(stagingId, options) → PromotionResult
```

**Forbidden:** Any code path that creates/updates `Contractor` from HCM JSON without passing through this service (**GOV-CTR-1**).

---

## 2. Pipeline state machine

### 2.1 Staging `pipelineStatus`

```text
EXTRACTED
    ↓ normalize()
NORMALIZED
    ↓ validate()
VALIDATED ──fail──► QUARANTINED
    ↓ approve() [optional human gate for wave 1]
APPROVED
    ↓ issueCtr()          [PR-CTR-5]
CTR_ISSUED
    ↓ promote()
PROMOTED
    ↓ publishIga()        [PR-CTR-6; post-cutover]
IGA_PUBLISHED
```

### 2.2 Staging `validationStatus`

| Status | Meaning |
|--------|---------|
| `PENDING` | Awaiting validation |
| `PASSED` | All blocking checks passed |
| `FAILED` | Blocking errors in `validationErrorsJson` |
| `QUARANTINED` | Routed to `hcm_contractor_quarantine` |
| `PROMOTED` | Successfully written to operational tables |

**GOV-CTR-2:** `promote()` requires `validationStatus = PASSED` **and** `pipelineStatus = CTR_ISSUED` (or `APPROVED` when CTR issuance is inline).

---

## 3. Sponsor validation (pre-promote)

| `HcmSponsorValidationStatus` | Promote default |
|------------------------------|-----------------|
| `VALID` | Allow |
| `MISSING` | **Deny** → quarantine `MISSING_SPONSOR` |
| `INACTIVE` | **Deny** → quarantine `INACTIVE_SPONSOR` |
| `UNKNOWN` | **Deny** → quarantine |
| `MISMATCH` | **Deny** → quarantine |
| `MULTIPLE` | **Deny** → quarantine |

**Override:** `options.governanceOverride` with `reason`, `actorUserId` → audit `OVERRIDE_APPLIED`; sets `canonicalizationStatus = OVERRIDE` on contractor.

**GOV-CTR-4:** On promote, copy `sponsorValidationStatus` to `ContractorEngagement.sponsorValidationStatus` and set `sponsorEmployeeId` from normalized payload.

---

## 4. Duplicate detection (pre-promote)

Run before `validationStatus = PASSED`:

| Check | Quarantine code |
|-------|-----------------|
| Active contractor same email (org scope) | `DUPLICATE_IDENTITY` |
| Same passport / national id | `DUPLICATE_IDENTITY` |
| Same supplier + normalized name | `DUPLICATE_IDENTITY` |
| Employee record collision (HCM/AD signal) | `EMPLOYEE_COLLISION` |

If duplicate is **same person** (proven link), route to **link/update** path in PR-CTR-4 — not auto-merge in PR-CTR-2.

---

## 5. `PromoteHcmContractorToCms` responsibilities

| Step | Action |
|------|--------|
| 1 | Load staging row + batch; assert org scope |
| 2 | Assert `validationStatus = PASSED` (or override) |
| 3 | Re-run sponsor + duplicate checks (idempotent) |
| 4 | Issue or confirm `CTR-{orgCode}-{seq}` via `ctr_sequence_registry` |
| 5 | Upsert `Contractor` (UUID PK + `contractorBusinessId`) |
| 6 | Upsert `ContractorEngagement` (sponsor fields + validation status) |
| 7 | Create `contractor_identity_map` row |
| 8 | Append `contractor_migration_audit` (`PROMOTED`) |
| 9 | Update staging: `validationStatus = PROMOTED`, `pipelineStatus = PROMOTED` |
| 10 | Optional: enqueue IGA outbox (when cutover flag enabled) |

**Transactional boundary:** steps 4–9 in a single DB transaction.

---

## 6. CTR issuance rules

```text
Format:  CTR-{Organization.code}-{8-digit-seq}
Example: CTR-LSO-00000001
```

| Rule | Enforcement |
|------|-------------|
| Issued only by promote service | `CtrSequenceRegistry.nextValue` increment |
| Never derived from HCM `person_number` | Code review + drift gate |
| Never reused | Unique index on `contractorBusinessId` |
| Stored on | `Contractor.contractorBusinessId` + `contractor_identity_map` |

Dry-run promote: **must not** increment sequence (PR-CTR-4).

---

## 7. Idempotency & replay (**GOV-CTR-5**)

| Scenario | Behavior |
|----------|----------|
| Re-import same `(batch, sourcePersonId, sourceHash)` | Unique constraint rejects duplicate staging row |
| Re-promote same `stagingId` already `PROMOTED` | No-op with success + existing `promotedContractorId` |
| New batch, same HCM person, new hash | New staging row; promote updates contractor via `legacySourcePersonId` match |

---

## 8. Validation implementation (PR-CTR-2B) ✅

| Service | Role |
|---------|------|
| `HcmContractorNormalizationService` | Raw HCM JSON → `NormalizedHcmContractor` |
| `HcmStagingValidationService` | `normalize()` + `validate()`; updates staging status only |
| `HcmStagingQuarantineService` | Writes `hcm_contractor_quarantine` + audit |

**Acceptance:** PR-CTR-2B validates and quarantines staging rows **without** promoting contractors, issuing `CTR-*`, mutating operational CMS records, or publishing IGA events.

## 9. TypeScript contract (PR-CTR-2C / PR-CTR-5)

See:

- `promote-hcm-contractor.contract.ts` — `PromoteHcmContractorToCms`, `PromotionResult`
- `migration-pipeline.contract.ts` — pipeline + validation enums, `ValidateHcmStagingRow`

Promotion implementation: **PR-CTR-5** ✅ (`PromoteHcmContractorToCmsService`).

**Acceptance:** PR-CTR-5 promotes only validated Oracle HCM contractor staging records into CMS by issuing immutable CTR-* identifiers, creating contractor and engagement records, writing identity/audit evidence, and publishing IGA context without allowing direct ETL writes into operational CMS tables.

---

## 9. IGA publish boundary

| Phase | IGA |
|-------|-----|
| Wave 1 dry-run | **Off** |
| Wave 1 promote (historical) | Config flag; default **Off** |
| Post cutover (Wave 2+) | **On** for `PROMOTED` / native creates |

Events (existing / extended outbox):

```text
contractor.created
contractor.updated
contractor.terminated
contractor.sponsor_changed
```

---

## 10. Acceptance criteria (PR-CTR-2)

- [ ] Migrations apply cleanly on empty and existing DBs
- [ ] Prisma client generates new models
- [ ] No production code writes `Contractor` from HCM except via promote contract (grep gate in PR-CTR-4)
- [ ] Docs + constitution cross-linked
- [ ] Workshop sample extract checklist completed before PR-CTR-3
