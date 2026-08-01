# PR-CMS-AUTHORITY-1 — Tenant authority modes

**Status:** COMPLETE

## Deliverables

| Item | Location |
|------|----------|
| Constitution v1 | [CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md](./CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md) |
| Schema | `Organization.supplierAuthorityMode`, `Organization.contractorAuthorityMode` |
| Create guard | `assertSupplierMasterCreationAllowed` in `suppliers.service.create` |
| Permission | `suppliers:governance-intake` (explicit only; not implied by `*:*`) |
| Profile API | `GET /auth/profile` → `tenantAuthority` |
| UI | `frontend/lib/tenant-authority.ts`, suppliers list + portal profile copy |
| Drift | `scripts/authority-drift-check.ts` (`npm run drift:authority`) |

## Defaults

| Tenant | `supplierAuthorityMode` | `contractorAuthorityMode` |
|--------|-------------------------|---------------------------|
| New orgs | `CMS_ONLY` | `CMS_ONLY` |
| DEMO seed | `ORACLE_ONLY` | `CMS_ONLY` (HCM bootstrap; CMS authoritative after import) |

## Tests

```bash
cd backend && npm run test:unit -- --testPathPatterns=supplier-authority.helper
cd backend && npm run test:e2e -- --testPathPatterns=supplier-authority
npm run drift:authority
```

## Evidence authority (derived from supplier mode)

| Mode | CMS onboarding documents for approval |
|------|----------------------------------------|
| `CMS_ONLY` | Required (jurisdiction checklist) |
| `ORACLE_ONLY` | Inherited from procurement when synced; CMS approves operational trust |
| `HYBRID` | CMS supplemental (full checklist today) |

See [SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md).

## Next

- **PR-CMS-DATA-2** — promote Oracle staging row → governance twin (no `ACTIVE` bypass) — **COMPLETE**
- **PR-CMS-INT-3** — adapter interfaces — **COMPLETE** — [PR-CMS-INT-3](./PR-CMS-INT-3_SOURCE_ADAPTER_BOUNDARY.md)
