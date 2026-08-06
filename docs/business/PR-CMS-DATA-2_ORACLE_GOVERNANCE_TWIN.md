# PR-CMS-DATA-2 — Oracle staging → governance twin

**Status:** COMPLETE

## Doctrine

```text
Promotion creates CMS governance representation, not supplier master authority.
```

Oracle Procurement creates the supplier master; CMS promotes a **governance twin** linked by immutable source keys.

## Flow

```text
Oracle supplier (upstream)
        ↓
POST /supplier-sources/oracle/import  → staging + reconcile
        ↓
POST …/staging/:id/promote  OR  POST …/staging/promote (batch)
        ↓
CMS Supplier (governance twin)
  status = PENDING_APPROVAL (never ACTIVE from promotion)
  sourceSystem = ORACLE_SUPPLIER_SAAS
  externalSupplierId = immutable after link
```

## API

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/supplier-sources/oracle/staging/:stagingId/promote` | Promote one row |
| POST | `/supplier-sources/oracle/staging/promote` | Promote all `MATCHED` / `NEW` (optional `stagingIds`) |

Promotable: `MATCHED`, `NEW`, `UNMATCHED`
Blocked: `CONFLICT`, `POSSIBLE_MATCH` (manual resolution first)

## Rules

| Rule | Enforcement |
|------|-------------|
| Never `ACTIVE` on promote | Create always `PENDING_APPROVAL`; link never sets `ACTIVE` |
| Evidence after promote | On `ORACLE_ONLY`, ops may approve to `ACTIVE` without CMS doc uploads when Oracle-linked + `SYNCED` — [SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md) |
| `MATCHED` | Links `proposedSupplierId`, sets Oracle source fields |
| `NEW` | Creates company governance profile |
| Duplicate Oracle id | `@@unique([organizationId, sourceSystem, externalSupplierId])` + service check |
| Idempotent re-promote | `IMPORTED` row returns existing twin |
| `POST /suppliers` on `ORACLE_ONLY` | Still blocked (AUTHORITY-1) |
| Source identity immutable | `PATCH /suppliers/:id` rejects `sourceSystem` / `externalSupplierId` changes |

## Audit

- `SUPPLIER_GOVERNANCE_TWIN_CREATED`
- `SUPPLIER_GOVERNANCE_TWIN_LINKED`
- `SUPPLIER_GOVERNANCE_TWIN_PROMOTED`

## Tests

```bash
cd backend && npm run test:e2e -- --testPathPatterns=supplier-oracle-governance-twin
cd backend && npm run test:unit -- --testPathPatterns=supplier-source-identity
npm run drift:authority
```

## Related

- [CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md](./CMS_MULTI_SOURCE_GOVERNANCE_CONSTITUTION_v1.md)
- [PR-CMS-AUTHORITY-1](./PR-CMS-AUTHORITY-1_TENANT_AUTHORITY_MODES.md)
- [PR-CMS-OPERATIONS-1D1](./PR-CMS-OPERATIONS-1D1_ORACLE_SUPPLIER_STAGING.md)
