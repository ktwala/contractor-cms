# ADR-006: Master Policy Decision Hierarchy

## Status
**Proposed / Under Discovery**

## Context & Problem Statement
We have defined four powerful, independent governance pillars:
1. **Supplier Governance** (`ADR-002`)
2. **Contractor Governance** (`ADR-003`)
3. **Financial Control Governance** (`ADR-004`)
4. **Purchase Order Governance** (`ADR-005`)

As these pillars mature into systemic enforcement, they will inevitably collide. For example: A supplier's contract expires (Supplier Governance = `FROZEN`), but their contractor submits a timesheet for work done *before* the expiry (Contractor/Financial Governance = `APPROVAL_REQUIRED`), against a Purchase Order that is still valid and heavily funded (PO Governance = `APPROVED`).

When these systems disagree, **which rule wins?**

Without a unified hierarchy, governance conflicts will cause unpredictable system behavior, looping edge cases, and compliance leakage. This ADR defines the **Master Policy Decision Hierarchy**, laying the groundwork for a unified Policy Decision Platform (PDP).

## Defined Scope
This ADR governs the precedence, conflict resolution, and deterministic outcomes when multiple governance lifecycles intersect during an operational or financial transaction.

---

## 1. Governance Order of Operations
To prevent race conditions and logical conflicts, the Policy Decision Engine must evaluate transactions sequentially from the widest entity boundary down to the specific transaction.

The canonical order of evaluation is:
1.  **Supplier Validity** (The legal entity boundary)
2.  **Contractor Validity** (The human executor boundary)
3.  **PO Authorization** (The budget boundary)
4.  **Financial Controls** (The transactional rule boundary)

*If a transaction is hard-blocked at Step 1, the engine does not bother evaluating Step 3.*

---

## 2. Enforcement Philosophy
The platform will operate on a **"Most Restrictive Rule Wins"** philosophy.
If the Supplier Governance allows a transaction (`VALID`), but PO Governance blocks it (`BLOCKED`), the final system state is `BLOCKED`. A `VALID` state in one domain cannot override a restriction in another domain.

---

## 3. Canonical Policy Decision Output
Rather than each domain returning custom error states, the centralized PDP engine will evaluate the matrices and return a single, canonical outcome for any transaction attempt (e.g., generating an invoice):

*   **`ALLOW`:** All four governance pillars pass.
*   **`WARN`:** Permitted, but flagged for audit (e.g., approaching expiry).
*   **`APPROVAL_REQUIRED`:** Hard-stopped pending explicit managerial override (e.g., late timesheet submission).
*   **`HOLD`:** Temporarily paused pending a compliance cure; no human override possible until the underlying data is fixed (e.g., Missing Supplier Master Agreement).
*   **`BLOCK`:** Absolute systemic rejection; no overrides permitted (e.g., billing for dates *after* a PO expiry).

---

## 4. Conflict Resolution Examples

By applying the Order of Operations and Enforcement Philosophy, the engine yields deterministic outcomes:

| Scenario | Supplier State | Contractor State | PO State | Financial Rule | PDP Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A: Total Compliance** | `Valid` | `Valid` | `Approved` | `Compliant` | **`ALLOW`** |
| **B: Ghost Worker** | `Valid` | `Frozen` | `Approved` | `Timesheet Submitted` | **`HOLD`** (Contractor invalid; PO budget is irrelevant) |
| **C: Unauthorized Spend** | `Valid` | `Valid` | `Expired` | `Invoice Submitted` | **`BLOCK`** (Legal entity & human are valid, but spend is unauthorized) |
| **D: Late Submission** | `Valid` | `Valid` | `Approved` | `Pre-Expiry Work Submitted Late` | **`APPROVAL_REQUIRED`** (Financial rule is most restrictive) |
| **E: Expired Master** | `Expired` | `Valid` | `Approved` | `Invoice Submitted` | **`HOLD`** (Supplier expiration blocks all downstream payouts) |

---

## 5. Exception Governance
Not all governance layers can be overridden equally.
*   **What can be overridden:** Financial Control rules (e.g., retroactive timesheet caps) and specific Contractor locks (e.g., delayed background checks) can be bypassed via a documented **Dual Approval Workflow** (`Ops + Finance`).
*   **What is an absolute hard stop:** Supplier Legal Invalidity, Missing POs (unless using the formal Emergency PO Shell workflow), and Post-Expiry Labor. These cannot be bypassed by an operator.

---

## 6. PDP Engine Vision
The ultimate vision is to abstract these rules out of individual microservices and controllers.

When a user clicks "Submit Invoice", the API does not query four different databases. Instead, it queries a centralized **Policy Decision Point (PDP)**:
`engine.evaluate(action: 'SUBMIT_INVOICE', context: { supplierId, contractorId, poId })`

The PDP returns the canonical `Decision Output` and any required `Exception Workflows`.

## Consequences
By defining this Master Policy Decision Hierarchy, we eliminate operational ambiguity. We are no longer building four disparate governance features; we are designing a single, unified, enterprise-grade Policy Decision Platform capable of deterministic spend control.
