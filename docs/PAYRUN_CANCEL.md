# PR-PAYRUN-CANCEL-1 — Governed payrun cancellation

## Purpose

Abandon a payrun **before** approval, payment, posting, or finalization. Cancellation is a **terminal** lifecycle state (`PayRunStatus.CANCELLED`); it is **not** the same as revert-to-draft, approval rejection, reversal workflows, or adjustment payruns.

## Behaviour

| From status | To | Notes |
|-------------|-----|--------|
| `DRAFT`, `SNAPSHOT`, `CALCULATED`, `IN_REVIEW` | `CANCELLED` | Allowed when no blocking payment batch exists. |
| `APPROVED`, `PAID`, `POSTED`, `FINALIZED`, `CALCULATING`, `CANCELLED` | — | Not cancelable via this API. |

**Payment batch gate:** cancel is rejected if any `payment_batches` row for the payrun has `export_status = GENERATED` **or** `status` not in `CANCELLED` / `FAILED`.

**Data:** the service updates `payruns.status` and appends a `[Cancelled] …` note. It does **not** delete `payrun_employees`, `employee_results`, or reconciliation rows (audit trail preserved).

## API

- **`POST /v1/payruns/:payrun_id/cancel`**
- **Permission:** `payrun:cancel`
- **Body:** `{ "reason": "<required string>" }`
- **Headers:** optional `x-reason` (audited alongside body reason)
- **Closed period:** subject to `PayrunClosedPeriodMutationGuardService` with operation **`payrun.cancel`**
- **Audit action:** `PAYRUN_CANCELLED`

## Distinctions (operator + engineering)

| Action | Meaning |
|--------|---------|
| **Cancel** | Terminal abandon **before** execution chain (no paid/posted/finalized; no active/exported batch). |
| **Revert to draft** | Moves `SNAPSHOT` / `CALCULATED` / `IN_REVIEW` → `DRAFT` for correction; requires `payrun:admin`. |
| **Reject (UI)** | Approval workflow / “reject” copy may still call revert or workflow-specific APIs — not cancel. |
| **Reversal / correction** | Post-execution governed paths (`reversal-workflows`, `correction-approvals`, adjustment payruns). |

## Drift gate

```bash
npm run check:payrun-cancel-drift
```

Static checks: transitions, `cancelPayrun`, controller route, permissions (backend + admin + seed), UI, client helper, unit spec, this doc.

## Related

- [`docs/PAYRUN_EXECUTION.md`](./PAYRUN_EXECUTION.md) — readiness-gated execution (cancel is **not** readiness-gated).
- [`scripts/check_payrun_execution_drift.ts`](../scripts/check_payrun_execution_drift.ts)

## Troubleshooting

### Browser shows `Cannot POST /v1/payruns/.../cancel`

That response is Express **404** (no route on the server that handled the request). Typical causes:

1. **API process is an older build** — restart Nest (`npm run start:dev`) or rebuild/restart the Docker `app` container so it includes `POST /v1/payruns/:payrun_id/cancel`.
2. **Admin dev proxy points at the wrong port** — with `npm run dev` in `admin-portal`, `/v1` is proxied to `VITE_PROXY_TARGET` (see `admin-portal/vite.config.ts`). Docker Compose exposes the API on **host port 4000**; local Nest without Docker often uses **3000**. Set `VITE_PROXY_TARGET` in `admin-portal/.env` to match where your API actually listens, then restart Vite.
3. **Direct API URL** — if you set `VITE_API_BASE_URL`, ensure it ends with `/v1` and targets the same API instance that has the cancel route.
