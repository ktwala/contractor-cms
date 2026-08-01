# PR-CMS-OPERATIONS-1D2 — Portal submission + PDP hooks

**Status:** COMPLETE

## Scope

- Supplier portal shows lifecycle status + jurisdiction evidence checklist
- Supplier user submits for approval when evidence is complete (`POST /supplier-portal/submit-for-approval`)
- Supplier user cannot self-approve (`SUPPLIER_SELF_APPROVAL_FORBIDDEN` on client approve route)
- PDP blocks operational actions when supplier is not `ACTIVE` (`SUPPLIER_NOT_APPROVED`)
- PDP blocks when required evidence is missing/expired on `ACTIVE` suppliers (`MISSING_REQUIRED_DOCS`), except Oracle-linked + synced suppliers on `ORACLE_ONLY` tenants (procurement evidence trusted — see [SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md))
- Supplier lifecycle reason codes enforced outside shadow mode via `PdpOperationalGuardService`

## Portal API

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/supplier-portal/profile` | `supplier-profile:read` — includes `onboarding`, `evidenceChecklist` |
| GET | `/supplier-portal/evidence-checklist` | `supplier-onboarding:read` |
| GET | `/supplier-portal/documents` | `supplier-documents:read` |
| POST | `/supplier-portal/documents` | `supplier-documents:manage` |
| POST | `/supplier-portal/submit-for-approval` | `supplier-onboarding:submit` |

Submit behaviour:

- `PENDING_APPROVAL` + incomplete evidence → `400` `SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE`
- `PENDING_APPROVAL` + complete evidence → `201` idempotent queue confirmation
- `DRAFT` + complete evidence → transitions to `PENDING_APPROVAL`
- Finance fields on profile remain redacted (no `supplier-bank-details:view` on portal roles)

## PDP enforcement

| Action | Guarded path |
|--------|----------------|
| `CREATE_CONTRACTOR` | `POST /supplier-portal/contractors` |
| `SUBMIT_TIMESHEET` | `PATCH /timesheets/:id/submit` |

Hard-enforced reason codes (evaluated decision, not shadow-overridden):

- `SUPPLIER_NOT_APPROVED`
- `MISSING_REQUIRED_DOCS`

## Tests

- `backend/test/supplier-portal-onboarding-pdp.e2e-spec.ts`
- `backend/src/pdp/rules/supplier.rule.spec.ts`

## Related

- Oracle staging does not change CMS lifecycle status (1D1 — `supplier-source-oracle.e2e-spec.ts`)
- Ops approval queue: `GET /suppliers/approvals` (1C); optional `?evidenceIncomplete=true`
- Governance tile navigation: [SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md)
