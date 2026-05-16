# PDP Enforcement Readiness Matrix

The transition from "Observe and Audit" (Shadow Mode) to "Active Enforcement" must be rolled out sequentially by domain risk. We cannot flip global enforcement on simultaneously, as it introduces severe false-positive and operational disruption risks. 

This matrix serves as the operational bridge between Shadow Mode telemetry and active platform governance.

## Readiness Thresholds

Before any Reason Code can progress to the next enforcement phase, the following conditions must be met:

### 1. Shadow Exit Threshold (Move to Visibility/Warning)
- **Shadow Block Rate**: `< 5%` of transactions flagged over 7 consecutive days.
- **Data Cleanliness**: Any missing data fields causing false positives must be backfilled.
- **Sign-off**: Domain Product Manager.

### 2. Soft Enforcement Threshold (Move to Approval Workflow)
- **Warning Dismissal Rate**: Users must successfully acknowledge and correct the warning in `< 3 days` on average.
- **Sign-off**: Operations Director.

### 3. Hard Enforcement Threshold (Move to Hard Block)
- **Override Rate**: Approval overrides must be utilized in `< 1%` of all workflows over 14 days.
- **False Positive Rate**: Zero verified system-induced false positives during the Warning Phase.
- **Sign-off**: Chief Compliance Officer / Head of Finance.

---

## Domain-by-Domain Enforcement Matrix

| Reason Code | Current Shadow Rate | Operational Risk | False Positive Risk | Recommended Enforcement Phase |
| :--- | :--- | :--- | :--- | :--- |
| **POST_EXPIRY_LABOR_PROHIBITED** | Pending Telemetry | **High** (Financial leakage) | **Low** (Deterministic dates) | **Phase 1: Hard Enforcement** |
| **TIMESHEET_LATE_SUBMISSION** | Pending Telemetry | **Medium** (Accounting friction) | **Low** (Deterministic dates) | **Phase 1: Approval Workflow** |
| **PO_MISSING** | Pending Telemetry | **High** (Unapproved spend) | **High** (PO system not fully mature yet) | **Phase 1: Visibility Only** |
| **SUPPLIER_MASTER_EXPIRED** | Pending Telemetry | **High** (Compliance breach) | **Medium** (Data sync delays) | **Phase 2: Warning → Approval** |
| **SUPPLIER_NOT_APPROVED** | Pending Telemetry | **High** (Legal breach) | **Low** (Strict boolean) | **Phase 2: Hard Enforcement** |
| **CONTRACTOR_OFFBOARDED** | Pending Telemetry | **Critical** (Access risk) | **Low** (Strict boolean) | **Phase 2: Hard Enforcement** |
| **PO_FUNDS_EXHAUSTED** | Pending Telemetry | **Medium** (Budget overruns) | **Medium** (Accrual sync delays) | **Phase 3: Approval Workflow** |
| **PO_EXPIRED** | Pending Telemetry | **Medium** (Budget overruns) | **Medium** (Amendment delays) | **Phase 3: Approval Workflow** |
| **CONTRACTOR_FROZEN_SUPPLIER_LAPSE** | Pending Telemetry | **High** (Compliance breach) | **Medium** (Cascading status delay) | **Phase 3: Hard Enforcement** |
| **CERTIFICATION_LAPSED_HIGH** | Pending Telemetry | **Critical** (Liability risk) | **Medium** (Document review delays)| **Phase 4: Hard Enforcement** |

---

## Phase Definitions

### Phase 1: High Leverage, Low Ambiguity
- **Target**: Rules based purely on strict mathematical bounds (e.g. `transactionDate > endDate`) that are universally enforced.
- **Action**: Immediately enforces `POST_EXPIRY_LABOR_PROHIBITED`. Routes `TIMESHEET_LATE_SUBMISSION` to managers. Emits UI warnings for `PO_MISSING`.

### Phase 2: Core Master Data Governance
- **Target**: Basic identity and legal validity blocks.
- **Action**: Blocks unapproved suppliers and offboarded contractors. Issues warnings for expired master agreements, providing a grace period to cure.

### Phase 3: Financial & Budget Control
- **Target**: Advanced commercial governance (Purchase Orders).
- **Action**: Enforces cascading freezes. Routes exhausted/expired PO invoices to exception workflows rather than hard blocking, preserving the supplier relationship while demanding internal remediation.

### Phase 4: High-Friction Compliance
- **Target**: Deep labor compliance and certification checking.
- **Action**: Hard blocks on lapsed critical certifications, preventing invoice submission entirely until documents are cured and validated by compliance officers.
