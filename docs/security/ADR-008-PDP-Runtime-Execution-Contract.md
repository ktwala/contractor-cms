# ADR-008: PDP Runtime Execution Contract

## Status
**Proposed / Under Discovery**

## Context & Problem Statement
With the Governance Domains (`ADR-002`-`005`), Hierarchy (`ADR-006`), and Explainability Catalog (`ADR-007`/`PDP_REASON_CODE_CATALOG.md`) formally defined, we must establish how backend services interact with the Policy Decision Platform (PDP) at runtime.

If microservices evaluate governance rules locally, the platform will immediately fragment into doctrine drift. We require a standardized runtime contract—a single execution interface—that guarantees all transactions pass through the PDP deterministically.

## Defined Scope
This ADR defines the execution interface, required I/O payloads, evaluation ordering, caching strategy, and failure modes for the PDP Engine.

---

## 1. Standard Engine Interface

No service may bypass the PDP. All financial and operational boundaries must invoke the PDP adapter using the canonical interface:

```typescript
const response = await pdpEngine.evaluate({
  action: 'SUBMIT_INVOICE',
  context: { ... }
});
```

---

## 2. Required Inputs (Context)

To make a deterministic decision without requiring the PDP to blindly fetch all data, the caller must provide a standard context payload.

```typescript
interface PDPContext {
  supplierId: string;
  contractorId?: string;
  poId?: string;
  timesheetId?: string;
  invoiceId?: string;
  transactionDate: Date; // The date of the operation (crucial for pre/post expiry rules)
}
```

---

## 3. Standard Output (The PDP Response)

The PDP will return a strongly typed response containing the canonical outputs and the metadata required for the UI and routing.

```typescript
interface PDPResponse {
  decision: 'ALLOW' | 'WARN' | 'APPROVAL_REQUIRED' | 'HOLD' | 'BLOCK';
  reason_code?: string; // From PDP_REASON_CODE_CATALOG
  reason_category?: string; // e.g., COMPLIANCE, LIFECYCLE
  severity?: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  reversibility?: 'REVERSIBLE_AFTER_CURE' | 'REVERSIBLE_AFTER_APPROVAL' | 'IRREVERSIBLE_NEW_TRANSACTION_REQUIRED';
  operator_role_owner?: string;
  next_action?: string;
}
```
*Note: If `decision === 'ALLOW'`, the other fields may be null.*

---

## 4. Evaluation Order (Precedence)

The engine must evaluate the context precisely according to the Master Policy Decision Hierarchy (`ADR-006`).
1. **Supplier** (Validates `supplierId`)
2. **Contractor** (Validates `contractorId`, if present)
3. **PO** (Validates `poId`, if present)
4. **Financial** (Validates `transactionDate` against boundaries)

*Optimization: The engine will "fail fast". If Supplier validation returns `BLOCK`, it immediately returns the response without executing the Contractor, PO, or Financial rule sets.*

---

## 5. Caching & Performance Strategy

Governance checks are read-heavy. The PDP must implement aggressive but safe caching:
*   **When to Cache:** Entity states that change infrequently (e.g., Supplier active status, PO budget caps) should be cached (e.g., Redis) with a TTL (e.g., 5 minutes) or cache-invalidation hooks tied to mutation events.
*   **When to Force Live Validation:** Transactions involving hard boundaries (e.g., exact `transactionDate` vs `endDate` bounds) or high-risk exceptions (e.g., Emergency PO execution) must bypass cache and execute a live database evaluation.

---

## 6. Failure Mode

If the PDP is unavailable (e.g., network partition to the rules engine, cache failure), the system must **Fail Closed**.
*   The transaction is aborted.
*   The UI displays a system error (e.g., "Governance Engine Unavailable").
*   We cannot risk "failing open" and allowing unauthorized spend during an outage.

---

## 7. Audit Logging

Every invocation of `pdpEngine.evaluate(...)` that results in a state *other* than `ALLOW` must generate an asynchronous canonical audit event (e.g., `FINANCIAL_BLOCK_TRIGGERED`) mapping to the `AUDIT_EVENT_CATALOG.md`. This ensures that blocks and exception requests are fully traceable by security and compliance teams.

## Consequences
By adhering to this execution contract, we decouple business rule processing from transaction processing. The PDP becomes the ultimate source of truth for spend authorization and workforce compliance.
