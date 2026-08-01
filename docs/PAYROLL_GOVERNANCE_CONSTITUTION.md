# PR-PAYRUN-GOV-META-1 — Payroll Governance Constitution / Change Control Charter

**Purpose:** Define how **governance documentation**, **baseline (LOCK) programs**, **drift scripts**, and **CI** themselves evolve. Payroll behavior is governed by **GOV-1 … GOV-7** and the **CONTAINER** vertical (**tax-year payroll shell**, [`docs/PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md)); **this document governs the governance framework** (constitutional / meta layer).

**Audience:** engineering leads, internal audit, PMO, security and compliance partners.

**Companion:** Operating map and pointers to every slice — [`docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md`](./PAYROLL_GOVERNANCE_MASTER_INDEX.md).

---

## 1. Governance hierarchy (layers)

Lower layers depend on upper intent; upper layers must remain **traceable** to lower enforcement.

| Layer | Role | Typical artifacts |
|-------|------|---------------------|
| **1 — Master Index** | Single routable map: which GOV slice and **CONTAINER** live where, what to run in CI, who reads what. | [`docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md`](./PAYROLL_GOVERNANCE_MASTER_INDEX.md) |
| **2 — GOV pillar docs** | Human-readable contract: behavior, routes, permissions, forbidden regressions, ownership. | e.g. `docs/PAYRUN_EXECUTION.md`, `docs/PAYRUN_FINANCIAL_CONTROL.md`, [`docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md) |
| **2b — CONTAINER pillar** | Tax-year **Payroll** shell doctrine (PayGroup → Payroll → PayPeriod), lifecycle, backfill — **PR-PAYROLL-CONTAINER-META-1**. | [`docs/PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md) |
| **3 — LOCK sections** | Baseline lock inside pillar docs: merge-freeze scope, required checks, forbidden regressions, explicit “next slice” or supersession notes. | Sections titled `PR-PAYRUN-GOV-*-LOCK`, `GOV-*-LOCK`, **`PR-PAYROLL-CONTAINER-4-LOCK`** |
| **4 — Drift scripts** | Executable static contract: files, strings, routes, and doc anchors that must not diverge. | `scripts/check_payrun_*.ts`, `scripts/check_payroll_import_drift.ts`, **`scripts/check_payroll_container_drift.ts`** |
| **5 — CI** | Non-optional execution of drift + tests on every protected merge path. | `.github/workflows/ci.yml` (and any job that gates payroll governance) |
| **6 — Runtime + tests** | Behavior and evidence: services, controllers, UI, Jest, Playwright. | `src/**/__tests__/**`, `test/playwright/**` |

**Rule of thumb:** If a reviewer cannot go from **user-visible or API behavior** → **LOCK text** → **drift** → **CI step** → **test** in under a few hops, the hierarchy is broken for that change.

---

## 2. Amendment rules (new GOV slice or new LOCK program)

Introducing a **new GOV slice** (new letter/number subdomain, e.g. GOV-5D, GOV-8) or **materially expanding** an existing slice is a **program change**, not a drive-by edit.

A complete amendment **MUST** land together in one change-set (or stacked PRs with no merge of partial state):

1. **Doc** — Pillar or control-plane markdown: intent, API/UI surfaces, permissions, failure modes, and a **LOCK** section (or extension of an existing LOCK) stating scope and forbidden regressions.
2. **Drift** — New or extended `scripts/check_*_drift.ts` (or equivalent) encoding anchors the team agrees are non-negotiable; `package.json` script wired. When the slice is part of **GOV-1 … GOV-7** or the **CONTAINER** vertical, extend the **META-2** registry in [`scripts/check_payroll_governance_constitution_drift.ts`](../scripts/check_payroll_governance_constitution_drift.ts) in the same change-set.
3. **Tests** — Service/unit tests proving the contract; Playwright or contract tests when the surface is user-facing or cross-service.
4. **CI** — A named step (or documented inclusion in an existing job) that runs the new drift and fails the pipeline on regression.
5. **LOCK** — Explicit baseline text in the governing doc (`*-LOCK`, `GOV-*-LOCK`) so audit and reviewers know what “frozen” means.

**Master Index** — Add or adjust the row for the slice in [`docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md`](./PAYROLL_GOVERNANCE_MASTER_INDEX.md) in the **same** change-set.

**Meta:** If this charter or the hierarchy itself changes, treat that as an amendment to **GOV-META-1** (see §7).

---

## 3. Supersession rules (deprecating or replacing a GOV slice)

1. **Declare in docs** — The superseded slice’s LOCK (or a dedicated subsection) states **replaced by** which slice/doc, effective as of merge date. Avoid silent removal of LOCK paragraphs without replacement narrative.
2. **Keep evidence until cutover** — Drift and tests for the old slice remain until behavior, routes, and audit expectations are fully migrated; then remove in **one** change-set that also updates Master Index, CI, and successor LOCK text.
3. **APIs and audit** — Deprecated HTTP paths or audit action names: document retention period (if any), client migration, and `410 Gone` or equivalent where product requires hard deprecation (pattern already used for direct policy create under GOV-7B).
4. **Identifiers** — Prefer retaining historical **PR-PAYRUN-GOV-*** ids in prose (“formerly PR-…”) so audit trails and old PRs still parse.

---

## 4. Naming conventions

| Pattern | Meaning | Example |
|---------|---------|---------|
| **GOV-*n*** | Programmatic slice label in docs, DTOs, drift comments, PMO ladder. | GOV-3A, GOV-5B, GOV-7B-2 |
| **PR-PAYRUN-GOV-*x*** | Pull-request / program identifier tied to a deliverable or LOCK program. | PR-PAYRUN-GOV-5A-LOCK |
| **\*-LOCK** | Baseline merge-freeze: required checks + forbidden regressions + ownership one-liner. | PR-PAYRUN-GOV-6C-LOCK |
| **GOV-META-*** | Meta-governance (this charter and successors). | GOV-META-1 |
| **PR-PAYRUN-GOV-META-2-LOCK** | v1 freeze: executable constitution drift + slice registry. | META-2-LOCK section in this document |
| **PR-PAYROLL-CONTAINER-META-1** | Constitutional index entry for the **CONTAINER** vertical (tax-year shell) in Master Index + META-2 registry. | PR-PAYROLL-CONTAINER-META-1 |
| **PR-PAYROLL-CONTAINER-4-LOCK** | Merge-freeze for shell lifecycle (close/archive preview, no hard delete). | Container LOCK |

Slices may use **sub-labels** (3A–3D, 5A–5C, 7A, 7B-2) when one PR family spans multiple verticals under one GOV number. The **CONTAINER** vertical uses **PR-PAYROLL-CONTAINER-*** program ids (see [`docs/PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md)).

## 5. Ownership doctrine (“one change-set”)

Any change that alters **observable governance** (gates, permissions, audit payloads, DTO fields used for supervision, drift anchors, or LOCK promises) ships as a **single coherent change-set** across:

- runtime code (backend + admin as applicable),
- tests,
- drift script(s),
- pillar or control-plane **doc including LOCK**,
- **Master Index** row updates,
- **CI** wiring when a new check is introduced.

Partial merges that update behavior without updating LOCK, drift, or tests are **out of charter** unless explicitly labeled **draft / WIP** and not merged to protected branches.

---

## 6. Audit doctrine (“no governance without evidence”)

1. **Behavior** that is claimed “governed” **MUST** be backed by **automated evidence** in CI (drift and/or tests) or by an explicitly documented **temporary exception** with owner, expiry, and remediation path (exceptions are rare and must not become permanent).
2. **Audit logs** — When a LOCK promises an audit action or payload field, drift or tests **MUST** anchor that promise so it cannot disappear silently.
3. **Review** — PR template or reviewer checklist should confirm: doc + LOCK + drift + CI + tests for the touched **GOV** slice(s) or **CONTAINER** change-set.

---

## 7. Meta-governance (“changes to governance require governance”)

1. **Edits to this constitution** or to the **Master Index** structure (not mere typo fixes) go through **normal PR review** with at least one reviewer familiar with payroll governance; material charter changes should be visible to **audit / PMO** (release note, internal comms, or agenda item as your org requires).
2. **Relaxing a LOCK** (shrinking forbidden regressions, removing drift checks, or dropping CI steps) is a **high-signal change**: requires explicit rationale in the PR description and, where applicable, replacement controls or risk acceptance recorded in the governing doc.
3. **Tightening a LOCK** (adding checks) is encouraged and should still update **Master Index** and any PMO-facing ladder text so the “maturity story” stays honest.

---

## PR-PAYROLL-CONTAINER-META-1 — Payroll container on the constitutional ladder

**Purpose:** Prevent the **tax-year payroll shell** from becoming a **parallel, undocumented** governance system beside **GOV-1 … GOV-7**.

**Canonical doctrine:** [`docs/PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md) (**PR-PAYROLL-CONTAINER-1 … PR-PAYROLL-CONTAINER-4-LOCK**).

**Master map:** [`docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md`](./PAYROLL_GOVERNANCE_MASTER_INDEX.md) — section **CONTAINER — Tax-year payroll shell governance**.

**Executable wiring:** **`npm run check:payroll-container-drift`** ([`scripts/check_payroll_container_drift.ts`](../scripts/check_payroll_container_drift.ts)); **META-2** registry row **`CONTAINER`** in [`scripts/check_payroll_governance_constitution_drift.ts`](../scripts/check_payroll_governance_constitution_drift.ts); **CI** — `lint-and-test` runs container drift **before** constitution drift (see **PR-PAYRUN-GOV-META-2-LOCK**).

**Amendment:** Same **§2 / §5** one change-set rule: pillar doc + LOCK + drift + tests + Master Index + registry + CI.

---

## PR-PAYRUN-GOV-META-2 — Governance health of governance (**GOV-META-2**)

**Purpose:** Make the constitution **executable**: machine-checked compliance that each **GOV-1 … GOV-7** slice **and** the **CONTAINER** vertical still have doc, drift, tests, CI, LOCK markers, and Master Index wiring. The **v1 governance framework** (runtime + map + charter + META-2) is **baseline-locked** under **PR-PAYRUN-GOV-META-2-LOCK** below.

---

## PR-PAYRUN-GOV-META-2-LOCK — Constitution drift baseline locked (v1)

**The governance framework itself is merge-frozen:** the **META-2** executable contract, **slice registry** in [`scripts/check_payroll_governance_constitution_drift.ts`](../scripts/check_payroll_governance_constitution_drift.ts) (**GOV-1 … GOV-7** plus **`CONTAINER`**), **[`docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md`](./PAYROLL_GOVERNANCE_MASTER_INDEX.md)** (including **CONTAINER** and the drift table rows for META-2 and container), **[`docs/PAYROLL_GOVERNANCE_CONSTITUTION.md`](./PAYROLL_GOVERNANCE_CONSTITUTION.md)** (this charter including **META-1**, **PR-PAYROLL-CONTAINER-META-1**, and **META-2-LOCK** text), **[`docs/PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md)** (container pillar + **PR-PAYROLL-CONTAINER-4-LOCK**), **`package.json`** scripts, **`.github/workflows/ci.yml`** steps, and **pillar LOCK programs** for **GOV-1 … GOV-7** and **CONTAINER** must evolve **together** when the framework changes. Treat partial updates as **governance debt**, not mergeable state on protected branches.

### Required checks

- **`npm run check:payroll-container-drift`** — [`scripts/check_payroll_container_drift.ts`](../scripts/check_payroll_container_drift.ts); runs in CI **before** META-2 (**PR-PAYROLL-CONTAINER-META-1**).
- **`npm run check:payroll-governance-constitution-drift`** — [`scripts/check_payroll_governance_constitution_drift.ts`](../scripts/check_payroll_governance_constitution_drift.ts); registry aligned with the Master Index (**GOV-1 … GOV-7** + **CONTAINER**).
- **CI** — `.github/workflows/ci.yml` **`lint-and-test`** job runs **payroll container drift** then **META-2** (after payrun governance policy drift, before `npm run test:cov`).

### Forbidden regressions

- **GOV or CONTAINER slice without registry entry** — any claimed **GOV-1 … GOV-7** slice or the **CONTAINER** vertical must appear in the META-2 `SLICES` registry and in the Master Index in the **same** change-set when added or renamed.
- **GOV or CONTAINER slice without LOCK** — no slice may ship without baseline / **LOCK** (or equivalent **baseline locked** program text) in the governing pillar or control-plane doc, as enforced by META-2 doc anchors.
- **GOV or CONTAINER slice without drift** — no slice may lose its `scripts/check_*_drift.ts` anchor or `package.json` `check:*` script without supersession documented under §3.
- **GOV or CONTAINER slice without CI** — `lint-and-test` (or an explicitly documented successor job) must continue to invoke each slice’s drift command.
- **GOV or CONTAINER slice without tests** — primary test files encoded in the META-2 registry must remain on disk and meaningful; do not hollow out coverage while keeping drift green.
- **CONTAINER vertical orphaned from constitution** — do not remove **PR-PAYROLL-CONTAINER-META-1** cross-references, the Master Index **CONTAINER** section, or [`docs/PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md) from the constitutional ladder without a **§3** supersession narrative.
- **Master Index / Constitution divergence** — the Master Index, this constitution, and the META-2 registry must not contradict each other (paths, npm script names, CI step intent).
- **Silent META-2 removal** — do not delete or bypass **`check_payroll_governance_constitution_drift.ts`**, its npm script, or its CI step without a replacement **governance-of-governance** control documented in this file and approved like §7.

### Ownership rule

**Constitution** (META-1 + **PR-PAYROLL-CONTAINER-META-1** + **META-2-LOCK**), **Master Index**, **META-2 drift registry**, **`package.json`**, **CI workflow**, and **per-slice** pillar doc + LOCK + drift + tests are **one governance change-set** for META-2 / framework regressions.

---

## Related

- [`docs/PAYROLL_GOVERNANCE_MASTER_INDEX.md`](./PAYROLL_GOVERNANCE_MASTER_INDEX.md) — implementation and evidence map (includes **CONTAINER**, META-2 drift row)
- [`docs/PAYROLL_CONTAINER_GOVERNANCE.md`](./PAYROLL_CONTAINER_GOVERNANCE.md) — tax-year shell doctrine and **PR-PAYROLL-CONTAINER-4-LOCK**
- [`docs/PAYRUN_GOVERNANCE_CONTROL_PLANE.md`](./PAYRUN_GOVERNANCE_CONTROL_PLANE.md) — GOV-5 … GOV-7 deep narrative and API tables
