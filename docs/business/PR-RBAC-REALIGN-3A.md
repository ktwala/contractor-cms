# PR-RBAC-REALIGN-3A — Permission catalog split and controller guard realignment

**Status:** **COMPLETE** (locked with 3B/3D)

**Baseline:** [`PLATFORM_GOVERNANCE_ROLES.md`](./PLATFORM_GOVERNANCE_ROLES.md)

## Objective

Decouple coarse permissions so production roles can separate:

```txt
Integration Operator ≠ Supplier Reviewer ≠ Contractor Manager
```

## Delivered

### Catalog additions (`permissions.constants.ts`)

| Permission | Purpose |
|------------|---------|
| `suppliers:sync` | Oracle supplier import/sync/promote |
| `suppliers:governance-scan` | Supplier drift detect/assign/resolve |
| `contractors:bootstrap` | HCM sync/import/materialize/admin promote |
| `contractors:governance-scan` | Workforce drift detect/assign/resolve |
| `workforce:cutover-manage` | Cutover ceremony + bootstrap decay |
| `contractor-remediation:manage` | Remediation lifecycle mutations |
| `pdp-restrictions:manage` | PDP activation + exception manage routes |

`contractor-migration:manage` and `suppliers:update` remain in catalog for **legacy seed rows** but are no longer used on connector/remediation/PDP manage routes.

### Controller realignment

| Module | Change |
|--------|--------|
| `oracle-supplier-import.controller.ts` | Sync vs governance-scan split |
| `oracle-hcm-import.controller.ts` | Bootstrap vs governance-scan vs cutover split |
| `contractor-migration-admin.controller.ts` | Bootstrap permission on ingest/validate/promote |
| `contractor-governance-remediation.controller.ts` | `contractor-remediation:manage` |
| `pdp.controller.ts` | `pdp-restrictions:manage` on manage handlers |

### Legacy bridge (`permission-evaluation.ts`)

Until **3B** removes coarse grants from seed bundles, roles that still hold `suppliers:update` or `contractor-migration:manage` satisfy the new fine-grained route guards.

### Demo seed (`seed-system-role-bundles.ts`)

- Added `GOVERNANCE_INTEGRATION_OPERATOR_PERMISSIONS` (target integration operator)
- `GOVERNANCE_OPERATIONS_ADMIN` now uses fine-grained integration perms (no `suppliers:update` / `contractor-migration:manage`)
- `GOVERNANCE_REVIEWER` — governance scan + remediation only (no bootstrap)

### Frontend (minimal 3a)

- `OracleConnectorOperationsPanel` — `suppliers:sync` + `suppliers:governance-scan`
- `HcmConnectorOperationsPanel` — `contractors:bootstrap`, `contractors:governance-scan`, `workforce:cutover-manage`

## Verify

```bash
cd backend && npx ts-node scripts/generate-permissions.ts
npm run test -- --testPathPattern=permission-evaluation
npm run rbac:verify   # if configured in package.json
```

Re-seed and re-login after deploy:

```bash
docker compose exec backend npm run db:seed
```

## Follow-on (complete)

- **3B** — [`PR-RBAC-REALIGN-3B.md`](./PR-RBAC-REALIGN-3B.md) production bundles; `LEGACY_PERMISSION_SATISFIES` removed
- **3D** — `backend/test/rbac-governance-separation.e2e-spec.ts`
