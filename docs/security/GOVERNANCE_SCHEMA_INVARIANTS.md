# Governance Schema Invariants

## Status
**Immutable Constitutional Layer**

## Context
As the External Workforce Platform matures into an **Enterprise Policy Decision Platform (PDP)**, governance can no longer be treated as isolated business logic scattered across microservices. Governance is the constitutional law of the platform.

To prevent **Governance Doctrine Drift**, all architecture, code, and documentation must rigorously adhere to the invariants defined in this document. Any deviation will trigger immediate CI failures.

---

## 1. Canonical Governance Hierarchy
Governance rules MUST be evaluated in the following strict precedence order. No document, matrix, or runtime service may alter or bypass this chain:
1.  **Supplier** (Legal Entity)
2.  **Contractor** (Human Executor)
3.  **PO** (Budget Authorization)
4.  **Financial** (Money Movement / Transactional Rules)

*A transaction that fails at a higher order (e.g., Supplier) immediately halts; lower-order rules are not evaluated.*

---

## 2. Canonical PDP Decisions
The PDP Engine and all associated business documentation MUST ONLY use the following canonical decision states:
*   `ALLOW`
*   `WARN`
*   `APPROVAL_REQUIRED`
*   `HOLD`
*   `BLOCK`

*States such as `ON_HOLD`, `DENY`, or `PERMIT` are strictly prohibited.*

---

## 3. Canonical Reversibility Values
All reason codes and exception workflows MUST map to one of the following canonical reversibility states:
*   `REVERSIBLE_AFTER_CURE`
*   `REVERSIBLE_AFTER_APPROVAL`
*   `IRREVERSIBLE_NEW_TRANSACTION_REQUIRED`

---

## 4. Most Restrictive Rule Wins
In any conflict between governance domains or rules, the system MUST enforce the most restrictive outcome. A `VALID` or `ALLOW` state in one domain cannot override a restriction in another.

---

## 5. Absolute Catalog Authority
The platform operates on a strict "deny-by-default" schema model for its core metadata. The system MUST NOT emit, process, or document any of the following if they are not explicitly defined in their respective catalogs:
*   **No Unknown Reason Codes:** Every code must exist in `docs/security/PDP_REASON_CODE_CATALOG.md`.
*   **No Unknown Audit Events:** Every event must exist in `docs/security/AUDIT_EVENT_CATALOG.md`.
*   **No Unknown Permissions:** Every permission must exist in the canonical RBAC matrix.

---

## 6. Centralized PDP Runtime
Services and controllers MUST NOT implement ad-hoc governance logic locally (e.g., `if (supplier.endDate < new Date()) { throw Error() }`). All policy checks MUST be routed through the canonical PDP Runtime interface (`engine.evaluate()`).

## Enforcement
These invariants are actively enforced by `.github/workflows/governance-drift.yml` and `scripts/governance-drift-check.ts`. Violating these rules requires explicitly amending the governing ADRs and catalogs via formal PR review.
