# Ratification state consistency review

**Status:** `ACTIVE` — **one-time** (or repeat only if §7.4 is re-run). **Final governance drift checkpoint before code:** after **[`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) §7.4**, before opening **PR-EXTID-SCHEMA-1A**.

**Purpose:** Prevent **governance mismatch** — e.g. constitution still **v0.5** while README claims **1A**-ready, or ADR still **DRAFT** while execution PRs cite **PROPOSED**.

**Not:** more doctrine or new gates beyond this checklist. **Do not** expand this file into a parallel framework; retire or shrink when the program no longer needs it.

---

## Prerequisites

- **[`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) §7.3** complete (all three signers + standard authorization line **§7.2**).
- **§7.4** steps **1–4** executed (or verify each box below matches intended end state).

---

## A. Verify §7.4 state transition (mandatory)

| Step | Check |
|------|--------|
| **1 — Constitution** | [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) document **Status** reads **`v1.0 RATIFIED`** (not `v0.5` / `DRAFT` for the constitution). |
| **2 — ADR** | [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) top **Status** is **`PROPOSED`** with the line from ratification record **§1** (not `DRAFT`). |
| **3 — Decision log** | [`OPERATING_MODEL_DECISION_LOG.md`](./OPERATING_MODEL_DECISION_LOG.md): **GOV-EXTID-01** recorded; **Changelog** has dated row for ratification + ADR **PROPOSED**. |
| **4 — README** | [`README.md`](../../README.md) doctrine baseline states **production-bound governance active for Schema Stream 1A only** (additive Prisma); downstream streams **separately gated**. |

---

## B. Header / marker alignment (no stale v0.5 / DRAFT)

| Check | Pass? |
|-------|--------|
| No **execution** doc still says “awaiting §7” where §7.3 is already done (update wording or archive note). |
| **ADR** body does not contradict **PROPOSED** (e.g. §11 table still describes lifecycle accurately). |
| **README** business table row for operating model matches **v1.0 RATIFIED** (not “v0.5 only” if ratification is done). |

**Suggested spot-checks (optional grep):** `v0.5` / `DRAFT` in `docs/business/CONTRACTOR_OPERATING_MODEL_V1.md`, `docs/security/ADR-EXTID-001*.md`, `README.md` — interpret results; some **v0.5** mentions in history/changelog are OK.

---

## C. Execution docs aligned (1A-ready narrative)

| Document | Expectation after §7.4 |
|----------|-------------------------|
| [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) | **1A** = structural substrate; merge gates unchanged. |
| [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) | Alignment header still valid; **G-EXTID-02** applicable to **1A** review. |
| [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md) | Ready to attach to **1A** PR. |
| [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md) | Template ready; PR will carry completed copy. |

---

## D. Changelog parity (governed files)

Each file touched in **§7.4** should have a **changelog** or **version** row noting ratification / **PROPOSED** / **1A**-ready (repo convention):

- [ ] `CONTRACTOR_OPERATING_MODEL_V1.md` — Version / internal changelog
- [ ] `ADR-EXTID-001` — Changelog
- [ ] `OPERATING_MODEL_DECISION_LOG.md` — Changelog (GOV-EXTID-01 row)
- [ ] `README.md` — If repo practice is to log governance baseline changes, add a line or rely on commit message (mark N/A if N/A)

---

## E. Pre–1A doctrine (branch discipline)

**1A success** = the **platform can represent** ratified doctrine in the data model — **not** that the platform **enforces** doctrine (enforcement: **1B+**, RBAC, HCM, IGA PRs).

**Allowed in 1A:** Prisma **additive** columns + migration + client regen — **structural substrate only.**

**Forbidden in 1A:**

```text
Business logic
RBAC
Workflow
Portal
API enforcement
UI
Seed role redesign
```

**Branch doctrine:** **No behavior change by design.**

**1A execution pack (attach to PR):** alignment header; [`EXTID_MIGRATION_SAFETY_CHECKLIST.md`](./EXTID_MIGRATION_SAFETY_CHECKLIST.md); [`SCHEMA_DIFF_REVIEW.md`](./SCHEMA_DIFF_REVIEW.md); field matrix vs design; null/default strategy; explicit out-of-scope declaration.

---

## F. After 1A — ladder reminder

```text
PR-EXTID-SCHEMA-1B → DTO/API exposure
PR-EXTID-SCHEMA-1C → Seed / backfill
PR-EXTID-SCHEMA-1D → Drift encode (begin with G-EXTID-02 — IGA lifecycle misuse; clearest anti-pattern, easiest to test)
PR-RBAC-REALIGN-1
```

---

## Sign-off (this checklist)

| Role | Name | Date | OK to open **PR-EXTID-SCHEMA-1A** |
|------|------|------|-----------------------------------|
| *(Architecture or Security / Governance — pick one owner)* | | | ☐ |

---

## References

- [`V1_0_RATIFICATION_RECORD.md`](./V1_0_RATIFICATION_RECORD.md) **§7.4** — mandatory state transition
- [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md)

---

## Changelog

| Version | Note |
|---------|------|
| 1.0 | Initial one-time consistency review |
