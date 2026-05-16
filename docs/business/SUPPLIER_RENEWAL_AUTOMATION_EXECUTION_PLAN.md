# Supplier Renewal Automation: Execution Plan

This execution plan serves as the technical blueprint for implementing automated enforcement of Supplier Renewal Governance. It ensures that engineering is ready to execute immediately upon stakeholder approval of `ADR-002`, translating business rules into asynchronous NATS orchestration.

## 1. Trigger Architecture

*   **Trigger Mechanism:** A daily scheduled NATS JetStream scheduled job (or a cron-triggered publisher) evaluating all active `SupplierContract` records against their `endDate`.
*   **Event Cadence:** The job evaluates expirations iteratively at the following thresholds:
    *   T-minus 90 Days
    *   T-minus 60 Days
    *   T-minus 30 Days
    *   T-zero (Expired)
*   **Idempotency Model:** To prevent spamming operations or duplicate audit logs, the orchestrator will maintain a `contract_lifecycle_state` or rely on deterministic deduplication keys in NATS (e.g., `contractId_event_90`), ensuring each notification/escalation threshold is triggered exactly once per contract lifecycle.

## 2. Event Schema

The Orchestrator will map time bounds to specific canonical NATS events:

*   `CONTRACT_EXPIRING_90`
*   `CONTRACT_EXPIRING_60`
*   `CONTRACT_EXPIRING_30`
*   `CONTRACT_EXPIRED`
*   `SUPPLIER_RENEWAL_BLOCKED` (Emitted if an action like an invoice is blocked due to expiration)
*   `SUPPLIER_SUSPENDED_AUTO` (Emitted *only* if the final policy dictates auto-suspension)

## 3. Enforcement Modes

The automation engine will be built with flexible enforcement tiers to match the approved policy:

*   **Visibility Only:** The system observes the date passing and updates the UI state (e.g., dynamic badges), taking no backend action.
*   **Warning:** The system emits early threshold events (90/60/30) and flags the contract for operational review.
*   **Approval Required:** High-risk renewals require explicit managerial approval to reset the `endDate`.
*   **Invoice Block:** The Invoices domain subscribes to the expired state and formally rejects any invoice submitted against an expired contract.
*   **Engagement Block:** The Contracts domain rejects the creation of new `ContractorEngagement` records for a supplier with zero active, unexpired contracts.
*   **Supplier Suspension:** (If approved) The system auto-updates `Supplier.status` to `SUSPENDED` upon total contract lapse, disabling all associated identity access.

## 4. Audit Requirements

Every automated enforcement action must be governed by the Audit Intelligence layer.

*   **Required Audit Event Names:** (Refer to Event Schema above).
*   **Severity Levels:**
    *   `INFO` for 90/60 day warnings.
    *   `WARNING` for 30-day alerts and `CONTRACT_EXPIRED`.
    *   `HIGH` for operational blocks (e.g., `SUPPLIER_RENEWAL_BLOCKED`).
    *   `CRITICAL` for `SUPPLIER_SUSPENDED_AUTO`.
*   **Dashboard Surfacing:** Events will appear in the Security Insights dashboard under the "Automated Enforcement" category.
*   **Alert Routing:** High and Critical events will be routed to the Security Operations Center (SOC) queue.

## 5. Rollback / Safety Controls

To ensure business continuity during the rollout of enforcement automation:

*   **Feature Flags:** Enforcement logic will be wrapped in a global `ENABLE_RENEWAL_ENFORCEMENT` flag.
*   **Dry-Run Mode:** The orchestrator will initially run in "Dry-Run" mode, where it evaluates rules and emits "shadow" logs indicating what *would* have happened, without actually blocking invoices or suspending suppliers.
*   **Org-by-Org Rollout:** Automation will be enabled selectively per `OrganizationId` to isolate risk.
*   **Manual Override Path:** Operational Admins will retain the ability to manually override suspensions or manually extend `endDate`s without waiting on automated batch cycles.

## 6. Test Plan

Before deploying the orchestrator to production, the following scenarios must be strictly validated:

*   **Time Simulation:** E2E tests utilizing fake timers (or isolated database setups) to simulate the passage of 90, 60, 30, and 0 days, verifying the exact sequence of emitted events.
*   **Multi-Contract Suppliers:** Ensuring a supplier with one expired contract but one active contract is *not* accidentally suspended.
*   **Partial Expiry:** Validating that an invoice is only blocked if it directly references the expired `ContractId`, not the supplier's other active contracts.
*   **Missing End Date:** Validating that indefinite contracts correctly bypass the expiry evaluation loop without throwing null-pointer exceptions.
*   **False Positive Prevention:** Ensuring timezone drift (e.g., evaluating at 23:00 UTC vs local) does not trigger premature expirations.
