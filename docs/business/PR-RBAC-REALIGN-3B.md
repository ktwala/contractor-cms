# PR-RBAC-REALIGN-3B — Production role bundles and legacy cleanup

**Status:** **COMPLETE** (locked with **PR-RBAC-REALIGN-3D**)  
**Depends on:** [`PR-RBAC-REALIGN-3A.md`](./PR-RBAC-REALIGN-3A.md)  
**Baseline:** [`PLATFORM_GOVERNANCE_ROLES.md`](./PLATFORM_GOVERNANCE_ROLES.md)

> Production RBAC baseline is locked. `governance.ops@` remains a **demo composite only**.

## Objective

Seed **production-shaped** role bundles, remove coarse permission coupling from default roles, and sharpen **supplier portal** role separation.

## Production roles seeded

| Role | Bundle constant | Demo login |
|------|-----------------|------------|
| `GOVERNANCE_INTEGRATION_OPERATOR` | `GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS` | `integration.operator@` / `IntegrationOps123!` |
| `SUPPLIER_GOVERNANCE_REVIEWER` | `SUPPLIER_GOVERNANCE_REVIEWER_PERMISSIONS` | `supplier.reviewer@` / `SupplierReview123!` |
| `CONTRACTOR_MANAGER` | `CONTRACTOR_MANAGER_PERMISSIONS` | `contractor.ops@`, `manager@` |
| `GOVERNANCE_AUDITOR` | `GOVERNANCE_AUDITOR_PERMISSIONS` | `governance.viewer@` (same bundle surface) |
| `CMS_ADMIN` | `*:*` | `admin@` |
| `SUPPLIER_ADMIN` | `SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN` | `supplier.admin@`, `supplier.portal@` |
| `SUPPLIER_MANAGER` | `SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_MANAGER` | `supplier.manager@` |

### Demo composite (not production)

| Role | Note |
|------|------|
| `GOVERNANCE_OPERATIONS_ADMIN` | `governance.ops@` — **DEMO ONLY**; unions integration + reviewer + contractor manager for connector UAT |

## Legacy cleanup

| Item | Change |
|------|--------|
| `CONTRACTOR_MANAGER` | Stripped `suppliers:approve`, `suppliers:sync` (`suppliers:update`), supplier lifecycle mutations |
| `GOVERNANCE_REVIEWER` | No `contractor-migration:manage` / `contractors:bootstrap` |
| `LEGACY_PERMISSION_SATISFIES` | **Removed** — coarse `suppliers:update` / `contractor-migration:manage` no longer satisfy fine-grained routes |
| `contractor.ops@` | Now `CONTRACTOR_MANAGER` (was `CONTRACTOR_OPERATIONS_USER`) |

## Supplier portal refinement

| Capability | Supplier Admin | Supplier Manager |
|------------|----------------|------------------|
| Profile update | Yes | No (read only) |
| Documents manage | Yes | Read only |
| Users manage | Yes | No |
| Onboarding submit | Yes | No |
| Contractors create/update | Yes | Yes |
| Invoices read | Yes | Yes (`supplier-invoices:read` — new) |
| Timesheets manage | Yes | Yes (`supplier-timesheets:manage` — new) |

**Rule:** Admin = portal administration; Manager = day-to-day operational visibility.

## Negative tests (3D)

[`backend/test/rbac-governance-separation.e2e-spec.ts`](../../backend/test/rbac-governance-separation.e2e-spec.ts):

- Integration operator → cannot approve suppliers / create contractors
- Supplier reviewer → cannot supplier sync / HCM bootstrap
- Contractor manager → cannot supplier sync / HCM bootstrap
- Governance auditor → cannot POST sync/bootstrap/scan

## Verify

```bash
cd backend && npm run db:seed
npx jest -c jest.unit.config.js seed-system-role
npm run test:e2e -- rbac-governance-separation
```

Re-login after reseed for JWT permission refresh.
