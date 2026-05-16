# EXTID migration safety checklist

**Status:** `DRAFT` — **execution** companion for **PR-EXTID-SCHEMA-1** (phased **1A–1D**). Use before opening each PR; attach completed checklist (or PR section) to the description.

**Upstream:** [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md), [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) (effective only after §7), [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md).

**Principle:** **Schema first, behavior later** — additive columns, nullable-first, no accidental business-rule breakage.

---

## PR description must include

```text
Alignment header (IMPLEMENTATION_DRIFT_GATES §1) — cite:
  V1_0_RATIFICATION_RECORD, ADR-EXTID-001, PR-EXTID-SCHEMA-1_DESIGN,
  IMPLEMENTATION_DRIFT_GATES, EXTID_MIGRATION_SAFETY_CHECKLIST (this doc)
Field matrix vs PR-EXTID-SCHEMA-1_DESIGN (added fields only)
For PR-EXTID-SCHEMA-1A only: SCHEMA_DIFF_REVIEW (completed — link or path)
For PR-EXTID-SCHEMA-1A only: RATIFICATION_STATE_CONSISTENCY_CHECK (completed after §7.4 — link or path)
Migration safety notes (this checklist §§1–3)
Backfill strategy (explicit N/A if none)
Seed compatibility (which phase: 1C vs same PR)
No destructive change statement
```

---

## 1. Existing row preservation

- [ ] Migration is **additive** only (no drop column / rename that loses data) unless separate approved ADR.
- [ ] No data rewrite that changes sponsor or supplier semantics in the same PR as first column add.
- [ ] Rollback story documented (reverse migration or forward-fix).

---

## 2. Seed re-run behavior

- [ ] `npm run` seed / documented seed path succeeds on **empty** DB after migrate.
- [ ] Seed succeeds on **existing** dev DB after migrate (idempotent or documented reset).
- [ ] No new **NOT NULL** constraint without default that breaks seed order.

---

## 3. Null safety

- [ ] New columns **nullable** until backfill phase (or safe DB default aligned with doctrine).
- [ ] Application read paths treat `NULL` as “unknown / not integrated” per design doc.
- [ ] No default that implies **ACCESS_ENABLED** or equivalent when `access_intent` is unset.

---

## 4. DTO compatibility

- [ ] New fields **optional** on responses until **1B** explicitly documents exposure.
- [ ] Create/update DTOs do not require new fields for legacy clients (unless versioned API).

---

## 5. API version compatibility

- [ ] Breaking JSON shape changes deferred or behind version flag (document if any).

---

## 6. Frontend no-break audit

- [ ] Generated types / consumers tolerate absent fields (optional chaining).
- [ ] No new required form fields for flows that predate schema (until product gate).

---

## 7. Good vs bad defaults (examples)

**Good:**

```text
sponsor_employee_id nullable initially
iga_integration_status default UNKNOWN (or equivalent enum)
access_enablement_status default NOT_REQUIRED where doctrine allows
```

**Bad:**

```text
Immediate NOT NULL sponsor enforcement on all historical rows
Seed hard-fail when sponsor null
Using IGA_PROVISIONED (or similar) as CMS workforce lifecycle
```

---

## 8. References

- [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) — anti-patterns  
- [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md) — **1A** merge gate  
- [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) — **G-EXTID-***  
- [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md)

---

## Changelog

| Version | Note |
|---------|------|
| 1.2 | **1A** PR block: **RATIFICATION_STATE** after §7.4 |
| 1.1 | **1A** alignment cites + **SCHEMA_DIFF_REVIEW** |
| 1.0 | Initial checklist |
