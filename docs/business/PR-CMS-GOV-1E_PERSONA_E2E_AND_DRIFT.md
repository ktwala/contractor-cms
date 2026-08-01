# PR-CMS-GOV-1E — Persona e2e + drift dashboards

**Status:** COMPLETE

## Doctrine

```text
Governance must be visible, testable, and drift-guarded — not only documented.
```

## Objective

Prove Oracle-first governance works end-to-end from persona, UI, API, and drift perspectives.

## Slices

| Slice | Deliverable |
| ----- | ----------- |
| 1E.1 | Persona e2e: Oracle-linked supplier completes compliance profile |
| 1E.2 | Persona e2e: portal cannot create supplier in `ORACLE_ONLY` |
| 1E.3 | Ops dashboard: Synced / Pending governance / Active / Suspended (clickable navigation) |
| 1E.3b | List filter `GET /suppliers?governanceBucket=…` |
| 1E.3c | Evidence authority policy (`ORACLE_ONLY` procurement trust) |
| 1E.4 | Drift: Oracle-only tenants cannot expose Add Supplier |
| 1E.5 | Drift: Oracle import/promotion cannot set `ACTIVE` |

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/suppliers/governance-dashboard` | Oracle-linked lifecycle bucket counts |
| GET | `/suppliers?governanceBucket=…` | Filtered supplier registry (Oracle-linked buckets) |
| GET | `/suppliers/approvals?evidenceIncomplete=true` | Queue rows blocked on CMS evidence only |

Buckets (Oracle-linked only) — full definitions: [SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md)

| Bucket | Definition |
|--------|------------|
| **Synced** | `sourceSyncStatus = SYNCED` |
| **Pending evidence / Pending governance** | `PENDING_APPROVAL` awaiting operational trust; under `ORACLE_ONLY` counts all pending governance, not missing CMS docs |
| **Active** | `status = ACTIVE` |
| **Suspended** | `status = SUSPENDED` |

## UI

- **Client** `/suppliers` — governance overview **links** when `ORACLE_ONLY` or `HYBRID` (tiles → filtered list or approvals)
- **Client** `/suppliers/approvals` — operational trust queue (`suppliers:approve` or `suppliers:suspend`)
- **Portal** `/supplier-portal/profile` — “Complete compliance profile” on Oracle tenants
- Create supplier hidden when `canCreateSupplierMaster` is false

## Tests

```bash
cd backend && npm run test:e2e -- --testPathPatterns=supplier-oracle-portal-persona
cd backend && npm run test:e2e -- --testPathPatterns=supplier-oracle-governance-dashboard
cd backend && npm run test:unit -- --testPathPatterns=supplier-governance-dashboard
cd frontend && npm test -- authority-ui-drift
npm run drift:governance
```

## Drift

| Script | Scope |
|--------|--------|
| `drift:authority` | Portal + client suppliers page authority copy |
| `drift:integration` | Adapter ACTIVE ban + governance dashboard route |
| `drift:governance` | Runs authority + integration |

## Acceptance rules

| Rule | Enforcement |
|------|-------------|
| `ORACLE_ONLY` portal shows “Complete compliance profile” | `tenant-authority.ts` + profile page + e2e profile |
| `ORACLE_ONLY` hides “Add Supplier” | `canCreateSupplierMaster` + drift |
| `POST /suppliers` 403 without `governance-intake` | `supplier-authority.e2e-spec.ts` |
| Promotion creates/links twin only | DATA-2 + INT-3 |
| Promoted supplier stays `PENDING_APPROVAL` | persona + governance-twin e2e |
| Dashboard reports Oracle lifecycle buckets | governance-dashboard e2e + UI |
| No CMS-master copy for Oracle tenants | drift + subtitles |

## Related

- [SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md) — evidence authority + tile navigation
- PR-CMS-INT-3 — adapter boundary
- PR-CMS-DATA-2 — governance twin promotion
- PR-CMS-AUTHORITY-1 — tenant authority modes
