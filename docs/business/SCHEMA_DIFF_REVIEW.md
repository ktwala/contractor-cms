# Schema diff review — PR-EXTID-SCHEMA-1A (template)

**Status:** `DRAFT` — **Per-PR** artifact. Copy to the PR branch (e.g. `docs/business/SCHEMA_DIFF_REVIEW_PR-EXTID-SCHEMA-1A.md`) or paste completed sections into the **PR-EXTID-SCHEMA-1A** description.

**Purpose:** Before merging **1A**, prove the migration is **structural substrate only** — no hidden behavior, no scope creep, no draft drift from [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md).

**When:** Required **before merge** of **PR-EXTID-SCHEMA-1A** (per [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) **§7**).

---

## 1. What changed?

*(List Prisma models + columns added; migration name.)*

| Model | Added columns | Nullable? | Default? |
|-------|----------------|-----------|----------|
| | | | |

---

## 2. What did **not** change?

*(Confirm no RBAC, seed logic, services, routes, UI, HCM, IGA in this PR.)*

```text
(e.g.) No changes to: permissions.catalog, seed role bundles, InvoicesService, PDP, frontend routes, IGA publishers
```

---

## 3. What is deferred?

*(Explicitly to 1B / 1C / 1D / later PRs.)*

```text
DTO exposure, API contract, seed backfill values, drift script encode, sponsor NOT NULL enforcement, access gate enforcement, role remap
```

---

## 4. What old assumptions remain?

*(e.g. `contractor_id` still primary app key; `supplierId` unchanged; CMS ACTIVE still not IGA state.)*

```text

```

---

## 5. Alignment confirmation

- [ ] **[`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md)** complete (post–§7.4, before **1A** merge).
- [ ] Matches [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) field matrix (added fields only).
- [ ] [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md) completed for this PR.
- [ ] **G-EXTID-02** review: no `IGA_PROVISIONED`-style CMS lifecycle; no sponsor/supplier conflation in schema.
- [ ] **V1_0_RATIFICATION_RECORD** §7 complete and **ADR-EXTID-001** **PROPOSED** before merge (unless recorded waiver).

---

## 6. References

- [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) **§7.4**
- [`RATIFICATION_STATE_CONSISTENCY_CHECK.md`](./RATIFICATION_STATE_CONSISTENCY_CHECK.md)
- [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md)

---

## Changelog

| Version | Note |
|---------|------|
| 1.1 | **§5** alignment: **RATIFICATION_STATE** complete before **1A** |
| 1.0 | Initial template |
