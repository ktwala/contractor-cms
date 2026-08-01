# PR-CMS-OPERATIONS-1D0 — Jurisdiction and supplier-source foundation

**Status:** COMPLETE  
**Blocks:** `PR-CMS-OPERATIONS-1D2` (portal + PDP) — Oracle staging import delivered in [1D1](./PR-CMS-OPERATIONS-1D1_ORACLE_SUPPLIER_STAGING.md)

## Doctrine

```text
Supplier countryCode = jurisdiction
Jurisdiction determines required evidence
Source system determines imported supplier facts
CMS determines governance status
```

Oracle Supplier SaaS is a **source system**, not the governance authority.

```text
Oracle supplier = exists in ERP
CMS supplier   = approved for contractor operations
```

CMS must not let Oracle directly activate suppliers.

## Supported jurisdictions (v1)

| Code | Evidence pack |
|------|----------------|
| `ZA` | South Africa (includes B-BBEE) |
| `LS` | Lesotho (no B-BBEE; includes trading licence for companies) |

Future: `BW`, `NA`, `SZ`, `ZM`, etc. — add packs without rewriting onboarding.

## Evidence packs

### South Africa (`ZA`)

- Company registration
- SARS tax clearance / PIN
- Bank confirmation letter
- B-BBEE certificate or affidavit (company)
- Director / representative ID
- Signed supplier agreement

### Lesotho (`LS`)

- Company registration / incorporation (company)
- LRA tax clearance / registration
- Bank confirmation letter
- Trading licence / business permit (company)
- Director / representative ID or passport
- Signed supplier agreement

## Supplier fields (CMS)

| Field | Purpose |
|-------|---------|
| `countryCode` | Governance jurisdiction (ISO 3166-1 alpha-2) |
| `country` | Address / legacy; kept in sync with jurisdiction |
| `sourceSystem` | `CMS_NATIVE` \| `ORACLE_SUPPLIER_SAAS` |
| `externalSupplierId` | Upstream master id |
| `externalSupplierNumber` | Oracle supplier number |
| `sourceLastSyncedAt` | Last import sync |
| `sourceSyncStatus` | `NOT_SYNCED` \| `PENDING` \| `SYNCED` \| `FAILED` |

## Staging model

`supplier_source_staging` (`SupplierSourceStaging`):

| Field | Purpose |
|-------|---------|
| `sourceSystem` | e.g. `ORACLE_SUPPLIER_SAAS` |
| `externalSupplierId` | Oracle id |
| `supplierNumber` | Oracle supplier number |
| `name` | Display name from source |
| `countryCode` | Jurisdiction hint |
| `taxRegistrationNumber` | Reconciliation key |
| `rawPayload` | Full connector payload |
| `matchStatus` | `UNMATCHED` \| `MATCHED` \| `CONFLICT` \| `IMPORTED` \| `REJECTED` |
| `proposedSupplierId` | CMS supplier link after reconcile |

## Integration pattern (no live API in 1D0)

```text
Oracle Supplier SaaS
        ↓
Connector job / REST pull          ← 1D1
        ↓
supplier_source_staging
        ↓
Mapping + validation (externalSupplierId, supplierNumber, taxRegistrationNumber, countryCode, name)
        ↓
CMS supplier profile
        ↓
CMS lifecycle / evidence / approval
```

Oracle may provide: name, supplier number, tax registration, sites, addresses, contacts, bank metadata (if permitted), payment terms, business classification, Oracle status, last updated.

Reconciliation keys: `externalSystem = ORACLE_SUPPLIER_SAAS`, `externalSupplierId`, `supplierNumber`, `taxRegistrationNumber`, `countryCode`, name similarity.

## Key files

| Area | Path |
|------|------|
| Jurisdiction | `backend/src/domain/suppliers/supplier-jurisdiction.constants.ts` |
| Evidence packs | `backend/src/domain/suppliers/supplier-evidence-catalog.ts` |
| Source constants | `backend/src/domain/suppliers/supplier-source.constants.ts` |
| Migration | `backend/prisma/migrations/20260521100000_supplier_jurisdiction_source/` |

## Tests

```bash
cd backend && npm run test:e2e -- --testPathPatterns=supplier-jurisdiction-evidence
```

## Revised sequence

```text
1D0 — jurisdiction + source-system foundation (this PR)
1D1 — Oracle Supplier SaaS connector mock / staging import
1D2 — portal submission + PDP hooks
1E  — drift / e2e hardening
```
