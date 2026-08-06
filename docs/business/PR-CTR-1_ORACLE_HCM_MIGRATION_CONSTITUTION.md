# PR-CTR-1 — Oracle HCM Contractor Migration Constitution

**Status:** `DRAFT` — design authority for HCM → CMS contractor cutover. **No ETL or API code** until this constitution and [`CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md`](./CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md) are reviewed.

**Program name:** CMS Contractor Canonicalization & Migration Program v1

---

## 1. Golden rule

```text
Oracle HCM     = legacy / transition source (history + initial load)
CMS            = contractor operational authority (system of engagement)
IGA / workflow = access governance (provision, certify, revoke)
```

Sponsor doctrine (locked): [`SPONSOR_ACCOUNTABILITY_MODEL.md`](./SPONSOR_ACCOUNTABILITY_MODEL.md) — HCM sponsor reference on placement; CMS publishes; IGA executes approvals (**PR-SPONSOR-REFERENCE-ONLY-1**).

---

## 2. Strategic decision — Option A (ratified target)

**Mirror + eventually authoritative** (recommended and adopted for this program):

| Phase | HCM | CMS |
|-------|-----|-----|
| Transition | Source of historical truth | Imports, normalizes, issues canonical IDs |
| Cutover | Create/update **frozen** for contractors | Create/update **master** |
| Steady state | HR reference / read-only or retired | Lifecycle, sponsor, publishing |

**Not adopted:** permanent downstream mirror (Option B) — conflicts with sponsor governance, lifecycle ownership, and IGA publish model.

---

## 3. Target architecture

```text
Oracle HCM (REST / BI extract)
        ↓
Migration + Normalization Layer (staging → validation → promote)
        ↓
CMS Canonical Contractor Registry
        ↓
IGA / AD / Managed systems / Reporting
```

**Integration preference (ordered):**

1. Oracle HCM REST APIs → scheduled ETL → CMS staging
2. Oracle BI / controlled flat-file extract
3. Manual CSV — **pilot only**, not steady state

---

## 4. Authority rules

| Object | Authority during transition | Authority after cutover |
|--------|---------------------------|-------------------------|
| Contractor identity (person) | HCM until Wave 2 freeze | CMS |
| Placement / engagement dates, role, cost center | HCM until freeze | CMS |
| Sponsor reference | HCM import; CMS validates | CMS (HCM lookup optional) |
| Supplier / vendor link | CMS (supplier master) + HCM correlation | CMS |
| Access provision / certification | IGA | IGA |
| Immutable business contractor ref | **CMS-issued only** | CMS |

**Parallel edit rule:** HCM and CMS must **not** both accept contractor create/update after cutover. Enforce via change freeze + delta sync + audit.

---

## 5. Canonical ID policy

CMS issues an **immutable business contractor reference**, separate from any HCM identifier.

```text
Format (v1):  CTR-{ORG}-{SEQUENCE}
Example:      CTR-LSO-00000001
```

| Rule | Requirement |
|------|-------------|
| Issued by | CMS only (never copied from `person_number`) |
| Mutability | Immutable after assignment |
| Reuse | Never reuse retired numbers |
| HCM keys | Stored as `legacy_hcm_person_id` / `legacy_hcm_person_number` in identity map |
| Technical PK | Existing `Contractor.id` (UUID) remains; business ref is additional |

**Alignment:** [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) `external_person_id` — may hold HCM correlation until business ref is backfilled; do not conflate with `CTR-*` display ref.

---

## 6. Governance invariants (post-migration)

A CMS contractor **placement** (engagement) must not be promoted to operational **ACTIVE** without:

```text
✓ valid sponsor reference (sponsorEmployeeId)
✓ valid lifecycle state
✓ valid source provenance (source_system, migration_batch_id or native create)
✓ supplier linkage resolved in CMS
```

Optional demo inbox (`SPONSOR_ACCOUNTABILITY_INBOX_ENABLED`) does **not** change these rules.

---

## 7. Migration waves

### Wave 1 — Historical import (dry-run capable)

- Active contractors from HCM
- Recently inactive (12–24 months)
- Load → `contractor_staging_hcm` → validate → promote to registry
- **No** downstream IGA publish until validation sign-off

### Wave 2 — Controlled cutover

- Freeze contractor create/update in HCM
- Final delta sync
- CMS becomes create/update master
- Enable IGA publish for net-new / material changes

### Wave 3 — Downstream activation

CMS publishes (via existing / extended outbox):

```text
contractor.created
contractor.updated
contractor.terminated
contractor.sponsor_changed
```

---

## 8. Data quality gates (pre-promote)

| Control | Action on failure |
|---------|-------------------|
| Duplicate email / passport / vendor+name | Quarantine staging row |
| Sponsor missing / inactive in HCM directory | Quarantine or default deny promote |
| Expired placement, no end date, future-dated anomalies | Exception queue |
| Identity collision (contractor ↔ employee) | Manual correlation review |
| Inactive HCM but active access signals | Flag for IGA reconciliation |

---

## 9. Major risks

| Risk | Mitigation |
|------|------------|
| HCM dirty data | Staging + validation engine; no direct promote |
| Identity collisions | `contractor_identity_map` + manual review queue |
| No immutable CMS business ID | **CTR-*** issuance in Wave 1 promote |
| Parallel HCM/CMS edits | Cutover freeze + single write master |
| Migration drift vs EXTID program | This constitution **extends** EXTID; schema changes follow [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md) |

---

## 10. Relationship to existing programs

| Artifact | Relationship |
|----------|----------------|
| [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) | Product constitution — CMS workforce + sponsor + IGA boundary |
| [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) | Identity / IGA substrate streams |
| [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) | Additive columns already partially in `schema.prisma` |
| [`SPONSOR_ACCOUNTABILITY_MODEL.md`](./SPONSOR_ACCOUNTABILITY_MODEL.md) | Sponsor = HCM ref; IGA approvals |
| **PR-CTR-1** (this doc) | HCM **population** migration authority |
| [`CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md`](./CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md) | Field-level schema + mappings |

---

## 11. PR sequence (recommended)

| PR | Scope |
|----|--------|
| **PR-CTR-1** | This constitution + canonical data model v1 (docs) |
| **PR-CTR-2** | Staging schema + promotion rules — [`PR-CTR-2_STAGING_SCHEMA.md`](./PR-CTR-2_STAGING_SCHEMA.md) |
| PR-CTR-2B | Validation state machine (service) |
| PR-CTR-2C | `PromoteHcmContractorToCms` implementation |
| PR-CTR-3 | HCM extract adapter (REST / file) |
| PR-CTR-4 | Validation engine + quarantine UI |
| PR-CTR-5 | `CTR-*` issuance + identity map backfill |
| PR-CTR-6 | Cutover runbook automation + IGA event enrichment |

**Gate:** No PR-CTR-2+ code without stakeholder sign-off on §2 (Option A) and §5 (ID policy).

---

## 12. Cutover runbook (summary)

1. Complete Wave 1 dry-run with reconciliation report (counts, quarantine, sponsor gaps).
2. Sign cutover window; communicate HCM freeze.
3. Run final delta import.
4. Flip CMS write authority; disable HCM contractor maintenance.
5. Enable IGA publish for promoted / updated rows.
6. Monitor: orphan sponsors, duplicate CTR refs, access without valid engagement.

Detail: [`CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md`](./CMS_CONTRACTOR_CANONICAL_DATA_MODEL_V1.md) §6.
