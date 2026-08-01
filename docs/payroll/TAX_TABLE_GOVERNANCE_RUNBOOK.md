# Tax table governance & statutory bootstrap — operator runbook

**PR-TAX-GOV-2B** — canonical operator copy for RBAC, statutory bootstrap, TTA, and payrun snapshot readiness.

---

## 1. Two different seeds (do not conflate)

| Script | Purpose |
|--------|---------|
| **`npm run db:seed`** (`prisma/seed.ts`) | **RBAC**: roles, permissions (including `tax_table_authoring_*`), role–permission links, pay items, etc. |
| **`npx ts-node prisma/seeds/tax-tables.seed.ts`** | **Country statutory bootstrap**: `pack_registry`, **ACTIVE** PAYE `tax_table_sets`, **ZA** statutory configs (UIF / SDL / MTC), etc. |

**Operator rule:** *RBAC seed ≠ statutory seed.*  
After permission-only changes, you may only need `db:seed`.  
After a **greenfield country** or empty `pack_registry` / PAYE tables, you need **`tax-tables.seed.ts`** (or an equivalent data load).

---

## 2. TTA vs `packRegistry` (locked architecture)

- **Tax Table Authoring (TTA)** governs the **PAYE `TaxTableSet` lifecycle** (draft → validate → simulate → approve → publish) via `/admin/payroll/tax-tables` and `/v1/tax-table-authoring/*`.
- **`pack_registry`** rows are **not** created by TTA publish. There are **no** request-driven Nest `src/` writers for `pack_registry` today; population is **seed/scripts** (especially `prisma/seeds/tax-tables.seed.ts`).
- **`PackRouterService`** reads **`pack_registry`** and **ACTIVE PAYE** `tax_table_sets` at snapshot time.

**False:** *“TTA publish alone makes a country payroll-ready.”*  
**True:** A country is **snapshot-ready** when an **ACTIVE** pack exists **and** an **ACTIVE** PAYE table resolves for the pay date (and ZA statutory configs are present per product expectations).

---

## 3. SPA permissions after RBAC changes

- Backend JWT validation reloads permissions from the DB on **each request**.
- The admin SPA caches permissions in **`localStorage`** (`admin_permissions`) from login and **`GET /v1/auth/me`**.
- Use **Refresh permissions** in the admin shell (top bar or sidebar) after `db:seed` / role changes, or **re-login**.

---

## 4. Verification commands (engineering)

```bash
# Drift: TTA constants vs seed, legacy route order, no can('tta:') RBAC aliases
npm run check:tax-gov-2a-drift

# DB: TTA permission rows + role mappings (requires DATABASE_URL + seed)
npm run verify:tta-rbac
```

Optional SQL: `scripts/sql/verify_tta_rbac.sql`

---

## 5. UI diagnostics

**Statutory Configuration** (`/admin/statutory-config`) includes **bootstrap & snapshot readiness** cards fed by **`GET /v1/admin/statutory-readiness/:country`** (optional query **`as_of=YYYY-MM-DD`**). Requires **`tax:read`** or **`tax_table_authoring_view`** (same family as legacy tax table list).

- **Pack ready** — at least one **ACTIVE** `pack_registry` row effective on the chosen date.  
- **PAYE ready** — at least one **ACTIVE** PAYE `tax_table_set` effective on that date.  
- **Statutory (ZA)** — **UIF**, **SDL**, and **MTC** rows (ZA seed). Lesotho bootstrap in seed may ship **pack + PAYE only**; statutory checks are empty for LS.

---

## 6. Suggested operator sequence (new tenant / new country)

1. Run **`npm run db:seed`** (RBAC).  
2. Run **`npx ts-node prisma/seeds/tax-tables.seed.ts`** (or your approved statutory bootstrap) for each country.  
3. In admin: **Refresh permissions** (or re-login).  
4. Confirm **Statutory Configuration** readiness is green for **ZA** / **LS**.  
5. Use **Tax Table Authoring** for governed PAYE changes going forward.  
6. Run a **payrun snapshot** on a test pay date; fix any `PackRouterService` resolution errors using this runbook.

---

## 7. References

- `PackRouterService` — `src/country-packs/services/pack-router.service.ts`  
- TTA module — `src/modules/tax-table-authoring/`  
- Legacy admin tax tables (read / preview) — `GET /v1/admin/tax-tables`  
- PR-TAX-GOV-2A — `/v1/auth/me`, `refreshAdminSessionFromApi`, `verify:tta-rbac`, `check:tax-gov-2a-drift`, Playwright `tax-table-authoring-rbac.spec.ts`
