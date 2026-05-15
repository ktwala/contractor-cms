# Seed role bundles — STREAM B (RBAC realignment)

**Status:** **PR-RBAC-REALIGN-1** — CLOSED · **PR-RBAC-REALIGN-2** — CLOSED · **PR-DOCS-SUPPLIER-TERMINOLOGY-1** — CLOSED.

**Purpose:** Canonical list of **target** system roles introduced as **seed candidates** (no default demo users). Runtime supplier portal, sponsor HCM binding, and row-scoped invoice reads are **not** implemented here.

**Source of truth (bundles):** [`backend/src/core/auth/seed-system-role-bundles.ts`](../../backend/src/core/auth/seed-system-role-bundles.ts) — imported by [`backend/prisma/seed.ts`](../../backend/prisma/seed.ts) upserts; covered by [`seed-system-role-bundles.spec.ts`](../../backend/src/core/auth/seed-system-role-bundles.spec.ts).

**Narrative / transition:** [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md).
