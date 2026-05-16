# Role Transition Matrix v1

**Status:** `DRAFT` — supports **V1.0 ratification** and **STREAM B** (RBAC realignment), sequenced **after** [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md) per [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md) **§4**.

**Closed (traceability):** **PR-DOCS-SUPPLIER-TERMINOLOGY-1** — CLOSED · **PR-RBAC-REALIGN-1** — CLOSED · **PR-NAV-IA-1** — CLOSED · **PR-RBAC-REALIGN-2** — CLOSED · **PR-SPONSOR-RUNTIME-1** — CLOSED · **PR-SPONSOR-GOVERNANCE-1** — CLOSED · **PR-HCM-SPONSOR-BRIDGE-1** — CLOSED · **PR-IGA-EVENT-CONTRACT-1** — CLOSED · **PR-IGA-OUTBOX-1** — CLOSED · **PR-IGA-EVENT-WRITE-1** — CLOSED · **PR-IGA-DISPATCHER-1** — CLOSED · **PR-IGA-DISPATCH-SCHEDULER-1** — CLOSED.

**Purpose:** Map **current seeded / implied personas** to **target doctrine personas** and define **deprecate → restrict → replace** paths without destructive role removal.

**Sources:** [`backend/prisma/seed.ts`](../../backend/prisma/seed.ts), [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md) **§6**, **§16**, **§19**.

---

## 1. Current seed roles (as-built)

| Role | Primary intent today | Invoice-related perms (seed) | Notes |
|------|----------------------|------------------------------|--------|
| **CMS_ADMIN** | Full operator | `*:*` | Wildcard; not a “persona drift” issue. |
| **CONTRACTOR_MANAGER** | Ops / governance | *(none for invoices)* | Aligns with “no default invoice” for manager; nav may lack invoices by design. |
| **FINANCE_USER** | AP / finance | `invoices:read`, `invoices:approve` | No `invoices:create` in seed — verify finance workflow expectations. |
| **CONTRACTOR** | Self-service worker | *(none — `invoices:read` removed, PR-RBAC-REALIGN-1)* | Timesheets + profile only until row-scoped invoice read exists. |

---

## 2. Target doctrine personas (from constitution §6)

| Target persona | Auth surface | First delivery |
|----------------|--------------|----------------|
| **Supplier Admin** | Supplier portal (optional) | Post portal MVP (**OD-04** interim OFF OK). |
| **Supplier Manager** | Supplier portal | Same. |
| **Client Contractor Admin** | Internal CMS | Maps closely to **CONTRACTOR_MANAGER** + expansions. |
| **Sponsor** | Internal (HCM-linked user) | New capability bundle: attest / reassign / trigger reviews — **not** a duplicate CMS_ADMIN. |
| **Finance** | Internal | Maps to **FINANCE_USER** + possible `invoices:create` if doctrine + finance agree. |
| **Security / IGA** | Internal + IGA tools | Split read-only CMS governance vs IGA execution (product packaging TBD). |
| **Platform Admin** | **CMS_ADMIN** (global) | Keep strict break-glass story. |
| **Optional Contractor / External Worker** | Contractor login optional | Replace naive **`CONTRACTOR`** bundle over time. |

---

## 3. Transition matrix (current → target)

| Current role | Target mapping (v1 direction) | Permission / nav changes (summary) | Transition |
|--------------|----------------------------------|-------------------------------------|------------|
| **CONTRACTOR** | **External Worker** (least privilege) | **`invoices:read` removed** (Phase 1 permission gate); add explicit read scoped to own placements when designed. | **Restrict** (done for list endpoint), then **replace** bundle in new tenants; **deprecate** legacy docs. |
| **CONTRACTOR_MANAGER** | **Client Contractor Admin** | Add sponsor workflows when schema exists; PDP unchanged at permission level unless new perms introduced. | **Extend**; no removal. |
| **FINANCE_USER** | **Finance** | Optionally add `invoices:create` if AP creates bills; align with billing doctrine **§8**. | **Extend** with ADR + finance sign-off. |
| **CMS_ADMIN** | **Platform Admin** | Document break-glass; no wildcard drift into custom roles (existing ADR-001 rules). | **Maintain** |

---

## 4. Target role bundles (seed candidates — PR-RBAC-REALIGN-1 / PR-RBAC-REALIGN-2)

These roles are **upserted in** [`backend/prisma/seed.ts`](../../backend/prisma/seed.ts) as **system roles with no default users** (portal / sponsor runtime enforcement is out of scope). **PR-RBAC-REALIGN-2** centralizes the three target bundles in [`seed-system-role-bundles.ts`](../../backend/src/core/auth/seed-system-role-bundles.ts) with unit tests — **must** stay aligned with the seed upserts.

| Role | Seed permissions (v1 candidate) | Notes |
|------|-----------------------------------|--------|
| **SUPPLIER_ADMIN** | `suppliers:create`, `suppliers:read`, `suppliers:update`, `suppliers:delete` | Future supplier-portal admin; org / `supplierId` scope TBD. |
| **SUPPLIER_MANAGER** | `suppliers:read`, `suppliers:update`, `timesheets:read`, `timesheets:approve` | Operations manager; not the wildcard-only test persona. |
| **SPONSOR** | `contractors:read`, `engagements:read`, `engagements:update` | Sponsor attest flows TBD; placeholder bundle only. |

Exact strings: [`seed-system-role-bundles.ts`](../../backend/src/core/auth/seed-system-role-bundles.ts) and [`permissions.catalog.json`](../../backend/src/core/auth/permissions.catalog.json).

---

## 5. Seed strategy (compatibility)

| Step | Action |
|------|--------|
| 1 | Add **parallel** “doctrine-compliant” demo user/role **alongside** legacy `CONTRACTOR` if demos must keep working during transition. |
| 2 | **Done (Phase 1):** `CONTRACTOR` no longer receives `invoices:read`; org-wide `GET /invoices` is denied at the permission gate. Row-scoped invoice read remains a follow-up. |
| 3 | Document breaking change in release notes when demo email behavior changes. |

---

## 6. Governance gates

- RBAC PRs require **alignment plan** row + gap matrix update.
- PR descriptions use the **alignment header** in [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md) **§1** when touching EXTID / sponsor / IGA surfaces.
- New permissions require **catalog** + drift script updates (existing CI).

---

## References

- [`SEED_ROLE_BUNDLES_PR_RBAC_REALIGN.md`](./SEED_ROLE_BUNDLES_PR_RBAC_REALIGN.md) — seed-only target bundles (aligned with **PR-RBAC-REALIGN-1**)
- [`EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md`](./EXTID_IMPLEMENTATION_ALIGNMENT_PLAN_V1.md)
- [`PR-EXTID-SCHEMA-1_DESIGN.md`](./PR-EXTID-SCHEMA-1_DESIGN.md)
- [`IMPLEMENTATION_DRIFT_GATES.md`](./IMPLEMENTATION_DRIFT_GATES.md)
- [`SCHEMA_IMPACT_REGISTER_V1.md`](./SCHEMA_IMPACT_REGISTER_V1.md)
- [`ADR-EXTID-001`](../security/ADR-EXTID-001-external-workforce-identity-sponsorship-iga-boundary.md) — identity / sponsorship / IGA boundary; **§6** outbound event catalog + [`backend/src/core/iga/`](../../backend/src/core/iga/) contract implementation (**PR-IGA-EVENT-CONTRACT-1**)

---

## Changelog

| Version | Note |
|---------|------|
| 2.3 | **PR-IGA-DISPATCH-SCHEDULER-1** — **CLOSED:** optional `IgaDispatchSchedulerService` interval worker (`IGA_DISPATCH_ENABLED`, `IGA_DISPATCH_INTERVAL_SECONDS`, `IGA_DISPATCH_BATCH_SIZE`); calls `processPending`; logs counts only; disabled by default. |
| 2.2 | **PR-IGA-DISPATCHER-1** — **CLOSED:** `IgaOutboxDispatcherService.processPending` + `IgaDeliveryProvider` stub; PENDING → SENT/FAILED + `lastAttemptAt`; no scheduler, retry policy, or real connector. |
| 2.1 | **PR-IGA-EVENT-WRITE-1** — **CLOSED:** contractor create/update + engagement sponsor assign/change → build + transactional outbox save (`IgaWorkforceEventWriter`); API fails if outbox save fails; no dispatch / connector. |
| 2.0 | **PR-IGA-OUTBOX-1** — **CLOSED:** `IgaOutboxEvent` table + `IgaOutboxDeliveryStatus` + `IgaOutboxService.save` (PENDING default); no dispatcher / transport / retries. |
| 1.9 | **PR-IGA-EVENT-CONTRACT-1** — **CLOSED:** outbound external-workforce **event contract v1** only — [`backend/src/core/iga/`](../../backend/src/core/iga/) (`IgaEventBuilder`, serializable payloads); no queue, bus, webhook, connector, or provisioning. |
| 1.8 | **PR-HCM-SPONSOR-BRIDGE-1** — **CLOSED:** optional HCM sponsor reference validation — `HcmSponsorLookupService` + `HcmModule`; `HCM_SPONSOR_VALIDATION_ENABLED` / `HCM_SPONSOR_REFERENCE_PATTERN`; engagements call `assertSponsorReferencesAllowed` after normalization when enabled; stub existence (no outbound HCM); no IGA / certification / UI. |
| 1.7 | **PR-SPONSOR-GOVERNANCE-1** — **CLOSED:** engagement sponsor baseline — `SPONSOR_ASSIGNED` enum + auto-default when `sponsorEmployeeId` set; reject `sponsorStatus` without primary sponsor; clearing primary clears delegate + status. |
| 1.6 | **PR-SPONSOR-RUNTIME-1** — **CLOSED:** engagement create/update accepts `sponsorEmployeeId`, `sponsorDelegateEmployeeId`, `sponsorStatus` (structural validation only; no HCM / governance / IGA enforcement). |
| 1.5 | **PR-RBAC-REALIGN-2** — **CLOSED:** `seed-system-role-bundles.ts` + unit tests lock `SUPPLIER_ADMIN` / `SUPPLIER_MANAGER` / `SPONSOR` bundles (non-runtime). |
| 1.4 | **PR-NAV-IA-1** — **CLOSED:** sidebar grouped into Operations / Governance / Administration; permissions unchanged (`frontend/lib/protected-routes.ts` + `frontend/components/dashboard-layout.tsx`). |
| 1.3 | PR-DOCS-SUPPLIER-TERMINOLOGY-1 + PR-RBAC-REALIGN-1 marked CLOSED; reference link to [`SEED_ROLE_BUNDLES_PR_RBAC_REALIGN.md`](./SEED_ROLE_BUNDLES_PR_RBAC_REALIGN.md) |
| 1.2 | PR-RBAC-REALIGN-1: `CONTRACTOR` invoice restriction; seed bundles for SUPPLIER_ADMIN, SUPPLIER_MANAGER, SPONSOR |
| 1.0 | Initial role transition matrix |
