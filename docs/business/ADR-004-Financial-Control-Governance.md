# ADR-004: Financial Control Governance

## Status
**Proposed / Under Discovery**

## Context & Problem Statement
We have defined the governance policies for our external entities (`ADR-002: Supplier Lifecycle Governance`) and our internal workforce (`ADR-003: Contractor Lifecycle Governance`). However, governance is fundamentally incomplete without financial enforcement.

If an entity or human is operating in a "Frozen" or "Expired" state, what happens to their ability to move money? Can an expired supplier still generate an invoice for past work? Can a non-compliant contractor submit a timesheet?

Without strict **Financial Control Governance**, lifecycle blocks exist only on paper, leaving the organization exposed to unauthorized spend, non-compliant billing leakage, and audit failures.

## Defined Scope
This ADR governs the intersection between entity/human lifecycle states and financial operations (timesheets, invoicing, and approvals).

*Out of Scope: Underlying payment gateway integrations or automated ledger postings.*

---

## Policy Discovery: Open Questions

To ensure money movement aligns perfectly with compliance, stakeholders must establish the following financial governance rules:

### 1. Timesheet Integrity
Timesheets are the origin of contractor spend. How strictly should they be governed?
*   **Submission:** Can a contractor whose engagement has expired submit a timesheet for hours worked *prior* to expiration?
*   **Editing:** Can a "Frozen" contractor edit timesheets that are already pending approval?
*   **Supplier Expiry:** If a supplier's master agreement expires, are all underlying contractor timesheets instantly blocked from submission?
*   **Grace Periods:** If a timesheet is submitted during an approved compliance grace period, does it hold a special "Approval Required" state, or flow normally?

### 2. Invoice Integrity
Invoices convert timesheets into actual spend.
*   **Generation:** Can a supplier with an expired master contract automatically generate a new invoice for unbilled timesheets?
*   **Expired Engagements:** Can an invoice legitimately contain line items from an engagement that expired mid-cycle?
*   **Mid-cycle Invalidations:** If a contractor becomes non-compliant (e.g., failed background check) *after* their timesheet is approved but *before* the invoice is paid, should the invoice approval be halted?

### 3. Approval Governance & Exceptions
When financial operations hit a lifecycle block, who holds the authority to unblock them?
*   **Override Authority:** Who can override a financial lifecycle block (e.g., Ops Admin vs. Finance Director)?
*   **Exception Workflow:** Does overriding a blocked timesheet require a formal multi-step approval, or just a single authorized click?
*   **Approval Tiers:** Do exceptions scale by dollar amount (e.g., overrides > $10k require VP approval)?
*   **Audit Requirements:** Must the user provide a mandatory justification string when bypassing a financial block?

### 4. Billing State Machine
We propose a distinct State Machine for billing artifacts (Timesheets & Invoices) that reacts to lifecycle changes:
*   **Valid:** Fully compliant; flows normally through standard approvals.
*   **Warning:** Processed with a visual flag (e.g., "Submitted 2 days before contract expiry").
*   **Hold:** Paused automatically by the system due to a minor lifecycle gap; awaits cure.
*   **Approval Required:** Hard-stopped; requires an explicit managerial override to proceed.
*   **Blocked:** Completely rejected by the system (e.g., attempted billing on a suspended supplier).

### 5. Enforcement Layers
How aggressively do we enforce these financial controls during rollout?
*   **Visibility Only:** Dashboards highlight "Spend at Risk" without stopping submission.
*   **Warning:** Soft UI warnings ("Your supplier contract is expired. Timesheet flagged for review.").
*   **Soft Block:** System prevents submission but offers a "Request Exception" button.
*   **Hard Block:** Submission completely disabled.

### 6. Audit & Automation Integration
To ensure absolute financial traceability, the system must emit the following canonical events to the Audit Intelligence layer whenever a control is activated:
*   `FINANCIAL_BLOCK_TRIGGERED`
*   `TIMESHEET_BLOCKED`
*   `INVOICE_BLOCKED`
*   `OVERRIDE_GRANTED`

## Consequences
By defining Financial Control Governance, we close the compliance loop:
1. **Entity Valid?** (Supplier Governance)
2. **Human Valid?** (Contractor Governance)
3. **Financially Allowed?** (Financial Control Governance)

This triad will form the foundation of our comprehensive Operational Governance Platform, ensuring zero unauthorized or non-compliant spend.
