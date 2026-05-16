# ADR-007: PDP Reason Codes & Explainability

## Status
**Proposed / Under Discovery**

## Context & Problem Statement
With the Master Policy Decision Hierarchy established (`ADR-006`), the platform can now make deterministic governance decisions (`ALLOW`, `WARN`, `APPROVAL_REQUIRED`, `HOLD`, `BLOCK`) across the Supplier, Contractor, PO, and Financial domains. 

However, a deterministic "black box" is operationally hostile. If a user submits an invoice and the system returns `HOLD` or `BLOCK` without context, operations teams will be paralyzed, unable to determine *why* the transaction failed or *how* to fix it. 

To transform governance into **operationally actionable governance**, the Policy Decision Platform (PDP) must possess an **Explainability Layer**. It must clearly communicate the exact reason for a block, whether the block is reversible, and the precise remediation path required.

## Defined Scope
This ADR defines the canonical reason codes, decision reversibility models, and the standard JSON response schema required from the PDP Engine.

---

## 1. Canonical Reason Codes

To eliminate ambiguity, the PDP will emit standardized, canonical reason codes. These codes must be globally unique and directly map to specific governance domains.

**Examples of Canonical Reason Codes:**
*   `SUPPLIER_MASTER_EXPIRED` (Supplier Governance)
*   `CONTRACTOR_FROZEN` (Contractor Governance)
*   `CERTIFICATION_LAPSED` (Contractor Governance)
*   `PO_MISSING` (Purchase Order Governance)
*   `PO_EXPIRED` (Purchase Order Governance)
*   `TIMESHEET_LATE_SUBMISSION` (Financial Governance)
*   `POST_EXPIRY_LABOR_PROHIBITED` (Financial Governance)

---

## 2. Decision Reversibility Model

Not all governance blocks are created equal. The system must explicitly distinguish between states that can be cured and states that represent absolute dead ends.

*   **Reversible (After Cure):** The transaction is on `HOLD`. It can proceed exactly as submitted *once the underlying data is fixed*. (e.g., A timesheet is on hold because the contractor's background check lapsed. Once the background check is renewed, the *same timesheet* can be processed.)
*   **Reversible (After Approval):** The transaction is flagged `APPROVAL_REQUIRED`. It violates a soft constraint (e.g., `TIMESHEET_LATE_SUBMISSION`) but can proceed via dual-approval exception workflow.
*   **Irreversible (New Transaction Required):** The transaction is a hard `BLOCK`. It is fundamentally invalid and cannot be cured. (e.g., `POST_EXPIRY_LABOR_PROHIBITED`. The user cannot fix this; they must delete the timesheet and stop working.)

---

## 3. Required PDP Response Schema

Every time a system queries the PDP (e.g., `engine.evaluate(action: 'SUBMIT_INVOICE', context: {...})`), the PDP must return a rich, structured explainability payload.

**Example Standard Payload:**
```json
{
  "decision": "HOLD",
  "reason_code": "SUPPLIER_MASTER_EXPIRED",
  "severity": "HIGH",
  "reversibility": "REVERSIBLE_AFTER_CURE",
  "message": "Supplier Master Agreement expired on 2026-04-30.",
  "next_action": "Renew supplier OR invoke approved emergency procurement exception."
}
```
*   `decision`: The canonical outcome (from ADR-006).
*   `reason_code`: The machine-readable string for routing and analytics.
*   `severity`: Operational urgency (`INFO`, `WARNING`, `HIGH`, `CRITICAL`).
*   `reversibility`: The exact classification from the Reversibility Model.
*   `message`: A dynamic, human-readable sentence explaining the exact failure context.
*   `next_action`: The prescriptive instruction detailing how to resolve the block.

---

## 4. UI / Operator Requirements

The front-end applications (e.g., Contractor Portal, Operations Dashboard) must consume this schema to prevent user frustration. When the PDP returns a non-`ALLOW` state, the UI must render:

1.  **Human-Readable Explanation:** Display the `message` prominently. Do not show raw generic database errors (e.g., "500 Internal Error").
2.  **Remediation Path:** Render action buttons based on the `next_action` and `reversibility`. If it is `REVERSIBLE_AFTER_CURE`, provide a deep link to the specific record that needs updating (e.g., "Click here to upload the missing background check").
3.  **Escalation Path:** If it is `REVERSIBLE_AFTER_APPROVAL`, expose the "Request Exception Override" button directly in the modal, triggering the dual-approval workflow.

## Consequences
By mandating an Explainability Layer, we prevent the PDP from becoming an opaque bottleneck. Governance constraints are immediately translated into clear operational directives, allowing the business to maintain strict compliance without sacrificing velocity or transparency.
