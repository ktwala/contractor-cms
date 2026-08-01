# PR-CMS-OPERATIONS-1D1 — Oracle Supplier SaaS staging import

**Status:** COMPLETE  
**Prerequisite:** [PR-CMS-OPERATIONS-1D0](./PR-CMS-OPERATIONS-1D0_JURISDICTION_AND_SOURCE_SYSTEM.md)

## Doctrine

```text
Oracle Supplier SaaS = source system (facts)
CMS Supplier          = governance authority (status, evidence, approval)
```

No live Oracle API in this PR. Imports use **mock JSON** (file-based extract shape).

## Flow

```text
Oracle extract / mock JSON
        ↓
POST /supplier-sources/oracle/import
        ↓
supplier_source_staging
        ↓
GET /supplier-sources/oracle/staging
        ↓
operator reviews match result
        ↓
future PR: promote / reconcile into Supplier
```

## API

### Import

```http
POST /supplier-sources/oracle/import
```

Permission: `suppliers:update`

```json
{
  "suppliers": [
    {
      "externalSupplierId": "ORA-10001",
      "supplierNumber": "SUP-10001",
      "name": "Maseru Logistics Pty Ltd",
      "countryCode": "LS",
      "taxRegistrationNumber": "LS-TAX-10001",
      "metadata": { "oracleStatus": "Approved" }
    }
  ]
}
```

Response includes `summary` (`matched`, `possibleMatch`, `new`, `conflict`) and per-row staging preview.

### List staging

```http
GET /supplier-sources/oracle/staging?matchStatus=NEW&page=1&limit=50
```

Permission: `suppliers:read`

## Reconciliation rules

| Status | Meaning |
|--------|---------|
| `MATCHED` | CMS supplier linked with same `externalSupplierId` (Oracle source) |
| `POSSIBLE_MATCH` | Single CMS hit on `externalSupplierNumber` and/or `taxNumber` |
| `NEW` | No CMS supplier matched |
| `CONFLICT` | Multiple CMS hits, or CMS linked to different Oracle id |

**Not performed on import:**

- CMS `status` is never changed
- No automatic activation
- No supplier profile overwrite (promote is a future PR)

## Fixture

`backend/test/fixtures/oracle-supplier-extract/mock-suppliers.json`

## Key files

| Area | Path |
|------|------|
| Import service | `backend/src/domain/supplier-sources/oracle-supplier-import.service.ts` |
| Reconciliation | `backend/src/domain/supplier-sources/supplier-source-reconciliation.service.ts` |
| Controller | `backend/src/domain/supplier-sources/oracle-supplier-import.controller.ts` |

## Audit

- `SUPPLIER_SOURCE_ORACLE_IMPORTED` — batch summary per import

## Tests

```bash
cd backend && npm run test:e2e -- --testPathPatterns=supplier-source-oracle
```

## Next

**1D2** — portal submission + PDP hooks
