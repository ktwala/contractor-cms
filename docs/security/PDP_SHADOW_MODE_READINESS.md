# PDP Shadow Mode Readiness

This document defines the operational criteria, metrics, and procedures required to transition the Policy Decision Platform (PDP) from **Shadow Mode** (observe and audit) into **Enforcement Mode** (active blocking).

## The Goal of Shadow Mode
The PDP currently evaluates live Prisma data against strict governance doctrine but forces the `effectiveDecision` to `ALLOW`. It emits the true result (`evaluatedDecision`) into the `AuditLog` table with the `SHADOW` tag.
This prevents the sudden introduction of a strict doctrine from causing widespread operational blockages (e.g., hundreds of active invoices suddenly being rejected due to missing POs).

## Readiness Criteria for Enforcement
Before `isShadowMode` can be disabled in `pdp.engine.ts`, the following criteria must be met:

1. **Low Friction Threshold**:
   - The overall shadow block rate must be **< 1%** of all transactions for 7 consecutive days.
   - Zero unexpected `HOLD` states triggered by application bugs.

2. **Data Cleanliness**:
   - Existing active suppliers must be marked as `ACTIVE` rather than `PENDING_APPROVAL`.
   - Missing Purchase Orders (`PO_MISSING`) on live invoices must be backfilled or excused.

3. **User Communication**:
   - Internal CMS administrators and Accounts Payable teams must be trained on the `PDP_REASON_CODE_CATALOG.md` meanings so they can explain rejections to external suppliers.

## Dashboard Monitoring
The **PDP Shadow Telemetry Widget** on the Analytics Dashboard actively aggregates these metrics by reading the `AuditLog`.
Watch the "Top Governance Friction Points" closely. If `PO_MISSING` is generating thousands of shadow blocks, the system is **NOT READY** for enforcement.

## Rollback Procedure
If Enforcement Mode is activated and causes an unforeseen catastrophic blockage:
1. Immediately switch the `isShadowMode` flag back to `true` in `PdpEngine` (or via environment variable if configured).
2. The system will instantaneously revert to "Fail Open/Observe" mode without requiring data patches or database rollbacks.
