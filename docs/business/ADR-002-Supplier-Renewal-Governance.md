# ADR-002: Supplier Renewal Governance Policy

## Status
**Proposed / Under Review**

## Context & Problem Statement
We have successfully implemented operational visibility for supplier contract renewals (dynamic badges, dashboard widgets, backend query filters). However, before automating any enforcement logic (e.g., auto-suspending suppliers whose contracts have expired via NATS), we must strictly define the business rules governing what expiry *means* to the platform. 

If we automate before defining policy, we risk suspending valid suppliers incorrectly, causing operational disruption, and generating false positives in our Audit Intelligence layer. Visibility must always precede policy, and policy must always precede automation.

## Defined Scope
This ADR governs the logical relationship between a Supplier's overarching state and the time-bound validity of their underlying Contracts.

*Out of Scope: NATS automation, cron enforcement, and technical auto-suspension implementation.*

## Policy Definitions

### 1. "Expiring Soon" Thresholds
* **Baseline Threshold**: 60 days before the contract `endDate`.
* **Configurability**: Currently static across the platform. *(Pending decision: Should this be configurable per Organization or Contract Type?)*

### 2. Supplier Validity Determination
A Supplier can have multiple contracts. How does contract expiry affect the overarching supplier validity?
* **Current State**: Supplier validity is determined by a manual `status` field (`ACTIVE`, `PENDING_APPROVAL`, `SUSPENDED`).
* **Active Contracts**: Does having *any* active contract keep a supplier globally valid, or is validity tied strictly to a designated *Primary* contract?
* **Missing End Dates**: Contracts without end dates are considered indefinitely valid until manually terminated.

### 3. Expiry Scenarios
What is the desired business outcome for the following scenarios?
* **All contracts expire**: Should the supplier be automatically transitioned to a `SUSPENDED` state?
* **One of many contracts expires**: The supplier remains `ACTIVE`, but the specific contract state becomes `EXPIRED`.
* **Renewal manually approved**: Should the operator update the `endDate` of the existing contract, or are they required to create a net-new `SupplierContract` record?

### 4. Audit & Alerting
* **Audit Events**: Should expirations emit governance audit events to the security index (e.g., `CONTRACT_EXPIRED`, `SUPPLIER_SUSPENDED_AUTO`)?
* **Alerting**: Is dashboard visibility sufficient for the operations team, or are proactive external alerts (e.g., email digests, Slack integrations) required for expiring records?

---

## Open Governance Questions for Review

To finalize this policy, stakeholders must align on the following decisions:

1. **Manual vs. Automated Status**: Should the Supplier `status` remain a manual operational field, or should it become an automated state machine strictly driven by underlying contract validity?
2. **Override Rules**: Should contract expiry automatically override an explicitly set `ACTIVE` supplier state?
3. **Operational Blocks**: Should a supplier with no valid, active contracts be blocked from:
    - Submitting new invoices?
    - Starting new engagements?
    - Timesheet approvals?
4. **Escalation Paths**: Should system warnings escalate progressively (e.g., 90 days → 60 days → 30 days → expired) or is a single threshold sufficient?

## Consequences
By defining this policy upfront, we ensure that when the asynchronous enforcement layer (NATS Orchestrator) is wired up, the rules engine will flawlessly execute business intent without risking the disruption of legitimate contractor supply chains.
