# PR-PAYRUN-GOV-3B — Payment export ↔ bank confirmation

## Trust question

**Did the bank confirm, reject, or partially settle what we exported?**

This is the first **external truth** governance layer: internal payroll controls (including GOV-3A register ↔ export) stop at export; **treasury / settlement** governance starts here.

## Canonical object

Batch-scoped **`PayrunBankReconciliation`** (one row per `payment_batch_id`); `payrun_id` is denormalized for payrun APIs and aggregation. A payrun may later support multiple batches; v1 uses the **controlling** batch (financial-control `payment_batch_id`, else latest `GENERATED` export).

## Lifecycle

- **Mark paid** — still governed by **GOV-3A** (readiness + financial control only).
- **Mark posted** — requires **readiness** + **GOV-3A** + **GOV-3B** (this gate).

Operational sequence:

**Calculate → Export → Reconcile (3A) → Bank confirm (3B) → Mark posted → …**

(Baseline narrative: **export → bank confirm → internal reconcile (3A) before pay → bank 3B before post**.)

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/payruns/:id/bank-reconciliation` | Current bank reconciliation for controlling batch |
| `POST` | `/v1/payruns/:id/bank-confirmation/import` | Import totals / counts / flags (CSV body optional for checksum) |
| `POST` | `/v1/payruns/:id/bank-confirmation/review` | Acknowledge required review (VARIANCE / REJECTED / PARTIAL) |

## Overrides (treasury-grade)

Permission: **`payrun:bank_override`** (separate from readiness and financial overrides).

Headers (must be allowed by CORS on the API):

- `x-bank-gate-override: approved`
- `x-bank-override-justification` — min length aligned with backend `PAYRUN_BANK_OVERRIDE_JUSTIFICATION_MIN`

Successful override → audit **`PAYRUN_BANK_RECON_OVERRIDE`**.

## Audit events

- **`PAYRUN_BANK_RECON_MATCH`** — import outcome MATCH
- **`PAYRUN_BANK_RECON_VARIANCE`** — import or review on variance / partial (payload distinguishes context)
- **`PAYRUN_BANK_RECON_REJECTED`** — import or review on rejected settlement rows
- **`PAYRUN_BANK_RECON_OVERRIDE`** — mark posted bank gate override

## Bank reconciliation baseline locked (PR-PAYRUN-GOV-3B-LOCK)

The **payment export ↔ bank confirmation** program is **baseline locked**: batch-scoped reconciliation, mark-posted gate ordering, treasury override contract, and admin behaviour are enforced in CI. Treat changes here as a **cross-cutting contract**, not a single-file tweak.

### Required checks (CI)

- **`npm run check:payrun-bank-reconciliation-drift`** — static contract vs module registration, `PayrunBankReconciliationService` audit and gate codes, controller routes and **mark posted** ordering (financial → **bank** → readiness), seed permission **`payrun:bank_override`**, CORS, **Payrun detail** bank panel and **`BANK_GATED_POST_ACTIONS`**, shared client, and spec presence (`scripts/check_payrun_bank_reconciliation_drift.ts`).
- **Backend:** `src/modules/payruns/__tests__/payrun-bank-reconciliation.spec.ts` — gate allow / block / override with audit expectations.
- **Frontend:** `admin-portal/src/utils/payrunBankReconciliationClient.test.ts` — override header shape, `PAYRUN_BANK_GATE_BLOCKED` detection, `canProceedMarkPostedWithBankControl` behaviour.

`check:payrun-financial-control-drift` also asserts that **mark posted** invokes the GOV-3B gate after GOV-3A so the two layers cannot silently diverge.

### Forbidden regressions

- **`mark-posted` without the bank gate** on the controller path (or reordering so readiness runs before bank reconciliation is satisfied).
- **Bank override without permission** — accepting override headers when the actor lacks **`payrun:bank_override`** (backend must deny; UI must not imply success).
- **Override without justification** — override approved without a justification meeting the **minimum length** (trimmed), aligned with `PAYRUN_BANK_OVERRIDE_JUSTIFICATION_MIN`.
- **Override without audit** — a successful override path that does not emit **`PAYRUN_BANK_RECON_OVERRIDE`** on the audit log.
- **Duplicate bank confirmation files allowed silently** — same settlement payload / hash must not attach to a **different** batch in the same org without **`DUPLICATE_SETTLEMENT_FILE`** (or equivalent documented behaviour); silent duplicates are a governance failure.
- **Frontend post action enabled while the backend would block** — primary or secondary CTAs for **mark posted** must stay consistent with bank reconciliation status, review state, and override rules (same inputs the API enforces).

### Ownership rule (bank reconciliation changes)

Any change that affects **bank import**, **reconciliation logic or persistence**, the **mark posted gate**, **admin UI**, **audit** events, **permissions**, **error contract**, or **duplicate-file policy** must land **together**:

1. **Import / reconcile / persist** — `PayrunBankReconciliationService`, Prisma model if persisted fields change.
2. **Gate** — `PayrunsController` wiring for **mark posted** (order vs financial control and readiness).
3. **UI** — Payrun detail (`BANK_GATED_POST_ACTIONS`, bank confirmation panel, override inputs, headers on gated requests).
4. **Audit** — match / variance / rejected / override actions and payloads remain truthful and searchable.
5. **Tests** — `payrun-bank-reconciliation.spec.ts` and `payrunBankReconciliationClient.test.ts` updated for the new behaviour.
6. **Drift gate** — `scripts/check_payrun_bank_reconciliation_drift.ts` (and financial drift where it encodes the 3A→3B ordering).
7. **Documentation** — this file (`docs/PAYRUN_BANK_RECONCILIATION.md`).

## Related

- [PAYRUN_FINANCIAL_CONTROL.md](./PAYRUN_FINANCIAL_CONTROL.md) — GOV-3A register ↔ export
- [PAYRUN_GL_RECONCILIATION.md](./PAYRUN_GL_RECONCILIATION.md) — GOV-3C register ↔ GL posting
- [PAYRUN_EXECUTION.md](./PAYRUN_EXECUTION.md) — readiness-gated execution

## Next slice (GOV-3C)

**Payroll register ↔ GL posting reconciliation** — extends trust from “what we calculated and paid” to “what the general ledger reflects” after mark posted. Baseline lock for 3C should mirror this document’s pattern when implemented.
