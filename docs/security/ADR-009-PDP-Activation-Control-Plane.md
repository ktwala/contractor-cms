# ADR-009: PDP Activation Control Plane

## Status
Proposed

## Context
The Policy Decision Platform (PDP) Engine is currently actively evaluating live database states in **Shadow Mode** across all tenants. As defined in the `PDP_ENFORCEMENT_READINESS_MATRIX`, we are preparing to transition specific rules from Shadow Mode into **Active Enforcement**.

Enforcing governance changes across an enterprise is high-risk. A single misconfigured policy could halt millions of dollars in valid invoice processing or falsely offboard critical contractors. Activating these rules via coarse environment variables (e.g., `ENABLE_PDP=true`) is insufficient, as it lacks granular targeting and is difficult to rapidly roll back without full application redeployments.

We need a dedicated **Activation Control Plane** to treat governance enforcement like an infrastructure deployment, ensuring we can pilot, canary, monitor, and rollback policies instantly.

## Decision
We will build a dynamic, database-driven **PDP Activation Control Plane** to manage the lifecycle of governance rollout.

### 1. Activation Dimensions
Governance rules will be activated or disabled along multiple fine-grained dimensions:
* **By Reason Code**: e.g., Activate enforcement specifically for `POST_EXPIRY_LABOR_PROHIBITED`.
* **By Action**: e.g., Enforce on `SUBMIT_TIMESHEET` but remain shadow for `SUBMIT_INVOICE`.
* **By Governance Domain**: e.g., Enforce all rules under the Supplier Governance pillar.
* **By Tenant/Organization**: e.g., Enable rules only for `ORG_ALPHA` during pilot phases.
* **By Environment**: Distinguish between dev, staging, and production enforcement levels.

### 2. Enforcement Levels
The Control Plane will manage the enforcement state along a strict progression:
* **SHADOW**: Engine evaluates, emits audit logs, but returns `ALLOW` to the UI.
* **WARN**: UI warns the user, but the user can dismiss and proceed.
* **APPROVAL_REQUIRED**: UI allows submission, but routes the artifact to an exception queue.
* **SOFT_BLOCK**: Submission blocked, but authorized managers can issue an override token.
* **HARD_BLOCK**: Submission unconditionally blocked. Curing the underlying data is the only path forward.

### 3. Feature Flag Architecture
* **Config Source**: The source of truth for activation will be stored in a dedicated `PdpActivationRule` table in the database, cached heavily in memory (e.g., Redis).
* **Rollout Precedence**: Specific rules override general rules. An Org-level disable overrides a Global-level enable.
* **Default Fail-Safe**: If the Control Plane is unreachable, the engine defaults to **SHADOW** mode (evaluate and observe without blocking) to ensure business continuity.
* **Emergency Kill Switch**: A global `PDP_EMERGENCY_OVERRIDE` flag that instantaneously downgrades the entire engine to Shadow Mode regardless of database state.

### 4. Canary Strategy
* **Pilot Tenant**: All new hard enforcements must be enabled on a designated "Friendly" pilot tenant first.
* **Percentage Rollout**: For high-volume actions, enforcement can be dialed in via a percentage metric (e.g., enforce on 10% of invoices first).
* **High-Risk Exclusion**: Specific critical VIP contractors or flagship suppliers can be explicitly exempted from Hard Blocks during the initial 30 days of rollout.

### 5. Rollback Strategy
Rollbacks must be instantaneous and granular.
* **Global Disable**: Triggering the Emergency Kill Switch.
* **Domain Disable**: Turning off the "Financial Control Governance" pillar completely.
* **Reason-Code Disable**: Disabling `SUPPLIER_MASTER_EXPIRED` if it triggers a false-positive storm.

### 6. Audit Requirements
Changes to the Control Plane are effectively changes to the corporate constitution.
* Every change must record the `actorId` (Who).
* Every change must record the `timestamp` (When).
* Every change must record the `scope` (What org/reason code).
* Every change must emit an `AuditLog` capturing the exact JSON payload `before` and `after` the modification.

### 7. UI/Admin Requirements
To support this, we will build a **Governance Activation Console** within the CMS Administration UI. This console will:
* Display a live matrix of all active policies and their current Enforcement Levels per tenant.
* Provide one-click "Downgrade to Shadow" buttons for rapid incident response.

## Consequences
### Positive
* **Deployment Safety**: We eliminate the risk of "big bang" compliance rollouts.
* **Granular Control**: We can tailor compliance strictness to the maturity of individual tenant organizations.
* **Immediate Remediation**: False positives can be handled via targeted overrides rather than code deployments.

### Negative
* **Engine Complexity**: The `PdpEngine` must now fetch, cache, and compute a complex intersection of activation rules before determining if its evaluation should be enforced or shadowed.
* **Testing Burden**: The matrix of tenant-by-action-by-reason-code testing requires significantly larger e2e test suites.
