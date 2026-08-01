# Policy Evaluation (not a source of truth)

> **Policy Evaluation does not own supplier, worker, contract, or identity truth. It consumes authoritative truths from governance capabilities and returns a decision: Permit, Restrict, or Deny.**

> **Facts are owned by governance capabilities. Policy only evaluates facts.**

The backend module remains `backend/src/pdp/` for compatibility. Operator surfaces use **Policy Evaluation** language — not “PDP” as another domain that stores parallel state.

---

## Authoritative truths vs decisions

| Question | Authoritative capability | Source |
| -------- | ------------------------ | ------ |
| Is this a valid supplier? | Oracle Supplier Portal | Oracle |
| Can this supplier participate? | Supplier Governance | EWP Operational Trust |
| Who is this worker? | Oracle HCM | Oracle |
| Is this an operational worker? | CMS Workforce Registry | EWP |
| Is this engagement valid? | Contracts / Engagements | EWP |
| Who is responsible? | Workforce Governance | EWP Responsible Manager |

**Policy Evaluation owns none of these.** It reads them and evaluates rules.

Example:

```text
Supplier Governance  → Operational Trust = Suspended
Workforce Registry   → Worker = Operational
Contracts            → Active contract

Policy Evaluation    → Deny onboarding (decision)
```

Another:

```text
Operational Trust    → Granted
Responsible Manager  → Missing
Contract             → Valid

Policy Evaluation    → Permit but Restrict
```

---

## Platform flow

```text
Oracle HCM
        │
        ▼
Workforce Discovery        (what exists?)
        │
        ▼
Worker Assessment          (what is wrong with this worker?)
        │
        ▼
Supplier Governance        (can this supplier participate?)
        │
        ▼
Operational Workforce      (what lifecycle state is each materialized worker in?)
        │
        ▼
Policy Evaluation          (what should happen?)
        │
        ▼
Permit · Restrict · Deny
```

Policy Evaluation comes **after** governance truths are established — not before.

---

## What Policy Evaluation must never do

- Store supplier status, worker readiness, or contract validity as its own truth
- Redefine Operational Trust or duplicate Supplier Governance readiness
- Appear in **Discovery** as if restrictions were discovered (restrictions are **evaluated**, not discovered)

Workforce Discovery may **display** policy decisions as outcomes (e.g. “Restricted by policy”) — it must not own the facts that policy reads.

---

## Operator language

| Avoid (operator UI) | Use instead |
| ------------------- | ----------- |
| PDP | Policy Evaluation |
| Operational restriction (PDP) | Restricted by policy |
| PDP = RESTRICTED | Policy decision: Restricted |
| Policy Restrictions Active (ambiguous) | Policy restrictions active (open tasks with restrict decision) |

Remediation enum `PDP_RESTRICTION` remains in the database; UI maps it to **Restricted by policy**.

### Policy outcome display (Workforce Discovery)

When Policy Evaluation restricts, show the **evaluation chain** so operators can follow *why* policy decided — not four unrelated fields:

```text
Policy Evaluation

Decision
Restricted

Evaluation
✗ Workforce Governance
  No Responsible Manager assigned

Result
Restricted

Next action
Assign a Responsible Manager
```

As more authoritative capabilities participate, add evaluators without redesigning the UI:

```text
Evaluation
✓ Supplier Governance — Operational Trust Granted
✓ Engagement Governance — Contract Active
✗ Workforce Governance — No Responsible Manager assigned
```

Every restriction looks identical. Only **which capability failed** changes.

API fields on remediation items when `pdpRestrictionsApplied`:

| Field | Role |
| ----- | ---- |
| `policyDecision` | Permit · Restrict · Deny |
| `policyEvaluationSteps` | Ordered PASS/FAIL chain per authoritative capability |
| `policyEvaluationReason` | Legacy flat finding (derived into steps when steps absent) |
| `policySourceTruth` | Legacy owning capability |
| `policyResolutionAction` | Next action under the owning capability |

---

## Platform layers

Policy Evaluation sits in a stable four-layer progression:

```text
Discovery        — What exists?
Governance       — What is true?
Integrity        — Does truth remain internally consistent?
Policy Evaluation — What should happen?
Operations       — Execute the decision.
```

**Integrity** verifies the constitution holds (e.g. Operational Worker ⇒ Operational Trust Granted).

**Policy Evaluation** interprets that constitution into decisions (Permit · Restrict · Deny).

Those are complementary — one verifies consistency, the other determines action.

### Freeze discipline (before expanding)

Do not add evaluators (Identity, Access, Assurance) until Policy Evaluation passes the same discipline used for Supplier Governance:

1. Identify authoritative inputs.
2. Eliminate parallel truth.
3. Prove decisions update live when governance facts change.
4. Define policy evaluation invariants (e.g. policy must never restrict on stale governance data).
5. Freeze the capability.

---

## Relationship to Supplier Governance freeze

Supplier Governance owns **Operational Trust**, **Workforce Impact**, and **Integrity**.

Policy Evaluation **consumes** Operational Trust (via `SupplierRuleEvaluator` reading `supplier.status`) — it does not redefine it.

Same doctrine as Joiner / Mover / Supplier Governance: **authoritative truth earned once, consumed everywhere.**

---

## Related docs

- [`SUPPLIER_GOVERNANCE_OPERATIONS.md`](SUPPLIER_GOVERNANCE_OPERATIONS.md) — Operational Trust authority
- [`CONNECTOR_GOVERNANCE_PLATFORM.md`](CONNECTOR_GOVERNANCE_PLATFORM.md) — connector remediation cascade
- [`DEMO-MTN-STORY.md`](DEMO-MTN-STORY.md) — Workforce Discovery projection populations
