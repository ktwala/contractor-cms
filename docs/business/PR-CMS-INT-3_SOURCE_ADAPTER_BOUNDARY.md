# PR-CMS-INT-3 — Source adapter boundary

**Status:** COMPLETE

## Objective

```text
External systems integrate through adapters.
CMS receives normalized supplier/contractor records.
Promotion and governance remain CMS-owned.
```

## Slices

| Slice | Deliverable |
| ----- | ----------- |
| 3A | `SupplierSourceAdapter` — `backend/src/integration/contracts/supplier-source.adapter.ts` |
| 3B | `OracleSupplierSourceAdapter` — wraps import + governance twin promotion |
| 3C | `ContractorSourceAdapter` + `OracleHcmContractorSourceAdapter` — HCM bootstrap ingest |
| 3D | `SourceAdapterRegistry` — tenant `supplierAuthorityMode` / `contractorAuthorityMode` |
| 3E | Controller + registry unit tests; `npm run drift:integration` |

## Architecture

```text
Controller (HTTP)
      ↓
SourceIntegrationService (facade)
      ↓
SourceAdapterRegistry (tenant authority)
      ↓
OracleSupplierSourceAdapter  |  OracleHcmContractorSourceAdapter
      ↓                              ↓
Staging (landing zone)         HCM staging batches
      ↓
SupplierGovernanceTwinPromotionService (CMS-owned; never ACTIVE)
```

## Authority gating

| Mode | Supplier Oracle adapter | HCM bootstrap adapter |
|------|-------------------------|------------------------|
| `CMS_ONLY` | off | off (supplier) |
| `ORACLE_ONLY` / `HYBRID` | on | — |
| `HCM_ONLY` / `HYBRID` | — | on |

Disabled adapter → `403` `SOURCE_ADAPTER_DISABLED`.

## API surface (unchanged routes)

| Area | Routes |
|------|--------|
| Oracle suppliers | `POST/GET /supplier-sources/oracle/*` |
| HCM contractors | `POST /admin/contractor-migration/batches/*` |

Controllers map HTTP DTOs → normalized integration DTOs at the boundary.

## Acceptance rules

| Rule | Enforcement |
|------|-------------|
| Oracle Procurement behind adapter | `OracleSupplierSourceAdapter` |
| Oracle HCM bootstrap behind adapter | `OracleHcmContractorSourceAdapter` |
| Staging = integration landing zone | Import/ingest only writes staging |
| Promotion = governance twins only | `SupplierGovernanceTwinPromotionService` |
| No adapter sets supplier `ACTIVE` | Promotion uses `PENDING_APPROVAL` only |
| Normalized DTOs at boundary | `normalized-supplier-source.dto.ts` |
| Tenant authority enables adapters | `SourceAdapterRegistry` |

## Drift

```bash
npm run drift:integration
npm run drift:authority
```

## Tests

```bash
cd backend && npm run test:unit -- --testPathPatterns="source-adapter.registry|oracle-supplier-import.controller|hcm-migration-admin.service"
cd backend && npm run test:e2e -- --testPathPatterns="supplier-oracle-governance-twin|supplier-source-oracle|supplier-authority"
```

## Related

- PR-CMS-DATA-2 — governance twin promotion
- PR-CMS-AUTHORITY-1 — tenant authority modes
- Next: **PR-CMS-GOV-1E** — persona e2e + drift dashboards
