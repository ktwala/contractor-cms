# Seed role bundles — PR-RBAC-REALIGN-1

**Purpose:** Canonical list of **target** system roles introduced as **seed candidates** (no default demo users). Runtime supplier portal, sponsor HCM binding, and row-scoped invoice reads are **not** implemented in this PR.

**Source of truth:** [`backend/prisma/seed.ts`](../../backend/prisma/seed.ts) (upsert blocks for `SUPPLIER_ADMIN`, `SUPPLIER_MANAGER`, `SPONSOR`, and the restricted `CONTRACTOR` bundle).

**Narrative / transition:** [`ROLE_TRANSITION_MATRIX_V1.md`](./ROLE_TRANSITION_MATRIX_V1.md).
