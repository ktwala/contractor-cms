# PR-CMS-OPERATIONS-1 — Supplier lifecycle operations

**Status:** `1A` · `1B` · `1C` · `1D0` · `1D1` · `1D2` · **AUTHORITY-1** · **DATA-2** · **INT-3** · **GOV-1E** COMPLETE

## Doctrine

| Entity | Terminal state |
|--------|----------------|
| **Supplier** | `OFFBOARDED` (not `TERMINATED`) |
| **Contractor** | `TERMINATED` |

### Supplier lifecycle states

```text
DRAFT → PENDING_APPROVAL → ACTIVE ⇄ SUSPENDED → OFFBOARDED → ARCHIVED
```

## PR-CMS-OPERATIONS-1A — Lifecycle contract (delivered)

### Transition matrix

| From | To |
|------|-----|
| `DRAFT` | `PENDING_APPROVAL` |
| `PENDING_APPROVAL` | `ACTIVE`, `SUSPENDED` |
| `ACTIVE` | `SUSPENDED`, `OFFBOARDED` |
| `SUSPENDED` | `ACTIVE`, `OFFBOARDED` |
| `OFFBOARDED` | `ARCHIVED` |

**Blocked (examples):** `OFFBOARDED → ACTIVE`, `ARCHIVED → ACTIVE`, `ACTIVE → DRAFT`, `PENDING_APPROVAL → ARCHIVED`

### Permissions

| Permission | Typical transition |
|------------|-------------------|
| `suppliers:submit-for-approval` | `DRAFT → PENDING_APPROVAL` |
| `suppliers:approve` | → `ACTIVE` |
| `suppliers:suspend` | → `SUSPENDED` |
| `suppliers:offboard` | → `OFFBOARDED` |
| `suppliers:archive` | → `ARCHIVED` |

Finance fields remain behind `supplier-finance:view` / `supplier-bank-details:view` (PR-FINANCE-RBAC-1).

### API

```http
PATCH /suppliers/:id/status
```

```json
{
  "targetStatus": "ACTIVE",
  "reason": "All onboarding evidence reviewed"
}
```

Illegal transition: `400` + `code: INVALID_SUPPLIER_STATUS_TRANSITION`

Self-approval: supplier membership cannot approve its own supplier (`403` + `SUPPLIER_SELF_APPROVAL_FORBIDDEN`).

Profile PATCH no longer accepts `status`; use the transition endpoint.

### Audit events

- `SUPPLIER_STATUS_CHANGED` (all transitions)
- `SUPPLIER_SUBMITTED_FOR_APPROVAL`
- `SUPPLIER_APPROVED`
- `SUPPLIER_REJECTED` (`PENDING_APPROVAL → SUSPENDED`)
- `SUPPLIER_SUSPENDED`
- `SUPPLIER_OFFBOARDED`
- `SUPPLIER_ARCHIVED`

### Key files

| Area | Path |
|------|------|
| Matrix + permissions | `backend/src/domain/suppliers/supplier-lifecycle.constants.ts` |
| Enforcement | `backend/src/domain/suppliers/supplier-lifecycle.service.ts` |
| API | `backend/src/domain/suppliers/suppliers.service.ts` (`transitionStatus`) |
| Migration | `backend/prisma/migrations/20260520120000_supplier_lifecycle_statuses/` |

### Tests

```bash
cd backend && npm run test -- --testPathPatterns=supplier-lifecycle
cd backend && npm run test:e2e -- --testPathPatterns=supplier-lifecycle
```

## PR-CMS-OPERATIONS-1B — Onboarding evidence (delivered)

> **Superseded for jurisdiction:** evidence packs are now country-aware (see **1D0**). ZA pack matches original 1B catalog; LS pack added.

### Core rule

Supplier cannot move to `ACTIVE` unless lifecycle allows it **and** required onboarding evidence is complete.

Applies to `PENDING_APPROVAL → ACTIVE` and `SUSPENDED → ACTIVE`. No PDP wiring in this slice.

### Required document catalog (v1)

| Code | Label |
|------|--------|
| `COMPANY_REGISTRATION` | Company registration (company only) |
| `TAX_CLEARANCE` | Tax clearance / tax pin |
| `BANK_CONFIRMATION` | Bank confirmation letter |
| `BBBEE_CERTIFICATE` | B-BBEE certificate or affidavit (company only) |
| `REPRESENTATIVE_ID` | Director / representative ID |
| `MASTER_SUPPLIER_AGREEMENT` | Signed master supplier agreement |

Finance redaction unchanged: document **metadata** is visible to ops; bank account / tax identifiers on the supplier profile remain behind `supplier-finance:view` and `supplier-bank-details:view`.

### API

```http
GET  /suppliers/:id/evidence-checklist
GET  /suppliers/:id/documents
POST /suppliers/:id/documents
PATCH /suppliers/:id/documents/:documentId
```

Incomplete approval attempt: `400` + `code: SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE` (includes checklist payload).

### Audit events

- `SUPPLIER_DOCUMENT_ADDED`
- `SUPPLIER_DOCUMENT_UPDATED`
- `SUPPLIER_DOCUMENT_EXPIRED`

### Key files

| Area | Path |
|------|------|
| Catalog | `backend/src/domain/suppliers/supplier-evidence-catalog.ts` |
| Checklist | `backend/src/domain/suppliers/supplier-evidence-checklist.service.ts` |
| Documents API | `backend/src/domain/suppliers/supplier-documents.service.ts` |
| Approval gate | `suppliers.service.ts` (`transitionStatus` before `ACTIVE`) |
| UI | `frontend/app/suppliers/[id]/page.tsx` |

### Tests

```bash
cd backend && npm run test -- --testPathPatterns=supplier-evidence
cd backend && npm run test:e2e -- --testPathPatterns=supplier-evidence
```

## PR-CMS-OPERATIONS-1C — Approval queue UI (delivered)

### UI

- Route: `/suppliers/approvals` — nav label **Supplier approvals** (Operations)
- Permission: `suppliers:approve` or `suppliers:suspend` (OR) — included on `GOVERNANCE_OPERATIONS_ADMIN` for demo ops
- Table: pending suppliers, evidence status (`Complete` / `Incomplete` / `Expired`), link to supplier detail
- **Approve** → `PATCH /suppliers/:id/status` `{ targetStatus: ACTIVE }` (blocked when CMS evidence incomplete; on `ORACLE_ONLY`, synced Oracle-linked suppliers inherit procurement evidence — see [SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md))
- **Reject** → `{ targetStatus: SUSPENDED }` with required reviewer note
- Query `?evidenceIncomplete=true` — only suppliers blocked on CMS checklist

### API

```http
GET /suppliers/approvals
GET /suppliers/approvals?evidenceIncomplete=true
```

Returns `PENDING_APPROVAL` suppliers with `evidenceStatus`, `evidenceComplete`, `canApprove` (false for self-scoped supplier membership).

Reject without note: `400` + `SUPPLIER_TRANSITION_REASON_REQUIRED`.

### Key files

| Area | Path |
|------|------|
| Queue API | `suppliers.service.ts` (`listApprovalQueue`) |
| UI | `frontend/app/suppliers/approvals/page.tsx` |
| Queue component | `frontend/components/suppliers/SupplierApprovalsQueue.tsx` |

### Tests

```bash
cd backend && npm run test:e2e -- --testPathPatterns=supplier-approvals
cd frontend && npm test -- supplier-approvals-page
```

## Revised operations sequence

| PR | Scope | Status |
|----|--------|--------|
| **1D0** | Jurisdiction + source-system foundation | COMPLETE — see [PR-CMS-OPERATIONS-1D0_JURISDICTION_AND_SOURCE_SYSTEM.md](./PR-CMS-OPERATIONS-1D0_JURISDICTION_AND_SOURCE_SYSTEM.md) |
| **1D1** | Oracle Supplier SaaS staging import | COMPLETE — see [PR-CMS-OPERATIONS-1D1_ORACLE_SUPPLIER_STAGING.md](./PR-CMS-OPERATIONS-1D1_ORACLE_SUPPLIER_STAGING.md) |
| **1D2** | Portal submission + PDP hooks | **COMPLETE** — [1D2_PORTAL_PDP.md](./PR-CMS-OPERATIONS-1D2_PORTAL_PDP.md) |
| **AUTHORITY-1** | Multi-source constitution + tenant modes | **COMPLETE** — [PR-CMS-AUTHORITY-1](./PR-CMS-AUTHORITY-1_TENANT_AUTHORITY_MODES.md) |
| **DATA-2** | Oracle staging → governance twin promote | **COMPLETE** — [PR-CMS-DATA-2](./PR-CMS-DATA-2_ORACLE_GOVERNANCE_TWIN.md) |
| **INT-3** | Source adapter boundary (Oracle/HCM) | **COMPLETE** — [PR-CMS-INT-3](./PR-CMS-INT-3_SOURCE_ADAPTER_BOUNDARY.md) |
| **GOV-1E** | Persona e2e + drift dashboards | **COMPLETE** — [PR-CMS-GOV-1E](./PR-CMS-GOV-1E_PERSONA_E2E_AND_DRIFT.md) |

## Governance overview navigation (GOV-1E extension)

Delivered on `/suppliers` when Oracle supplier connector is enabled:

| Tile | Drill-down |
|------|------------|
| Synced | `GET /suppliers?governanceBucket=synced` |
| Pending governance | `/suppliers/approvals` (`ORACLE_ONLY`) or `?evidenceIncomplete=true` |
| Active | `governanceBucket=active` |
| Suspended | `governanceBucket=suspended` |

Reference: [SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md)

## Locked baseline (unchanged by 1A)

PR-UI-TOKENS-1/2 · PR-FINANCE-RBAC-1 · PR-SHELL-NAV-CONTEXT-1 · PR-CMS-RUNTIME-HARDENING-1 · PR-CMS-FORMS-1/1A · PR-SUPPLIER-PORTAL-DATA-1 · PR-PDP-TEST-REPAIR-1
