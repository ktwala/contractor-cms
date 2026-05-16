# Purchase Order Policy Decision Matrix

This document provides a concise decision framework for business stakeholders to quickly review and approve the governance rules surrounding Purchase Order (PO) and Pre-Spend Authorization (detailed in `ADR-005`).

Approval of these settings will authorize the engineering team to transition the platform into an End-to-End Spend Governance engine, where invoices are only generated against pre-authorized commercial commitments.

## Decision Matrix

| Decision Area | Options | Recommended Default | Risk / Tradeoff |
| ------------- | ------- | ------------------- | --------------- |
| **1. PO Requirement** | • Optional<br>• Warning if missing<br>• Approval Required<br>• Hard Block (No PO → No Invoice) | **Hard Block** | "Optional" enables reactive billing and uncontrolled spend. "Hard Block" forces procurement discipline and ensures all spend is authorized prior to invoice generation. |
| **2. PO Budget Scope** | • Total monetary cap only<br>• Hours cap only<br>• Service line cap<br>• Combined model | **Combined model** | Monetary caps alone ignore rate deviations; hours caps alone ignore price changes. A combined model strictly enforces both volume and value authorized by procurement. |
| **3. PO Expiry** | • Ignore<br>• Warning<br>• Grace Period<br>• Block invoicing | **Block new drawdown; allow final reconciliation within grace** | Hard blocking immediately upon expiry prevents month-end close and payment for approved work. Blocking *new* spend but allowing a grace period for final reconciliation safely manages the closeout without leaving the budget open. |
| **4. PO Overrun** | • Allow<br>• Warning<br>• Approval Required<br>• Hard Block | **Approval Required** | Hard blocking a minor overrun (e.g., $10 over) can severely stall accounts payable. "Approval Required" forces a manager to accept the budget breach before the invoice is matched. |
| **5. Supplier / PO Match** | • Warning<br>• Approval Required<br>• Hard Block | **Hard Block** | Allowing mismatched suppliers (e.g., billing subsidiary B against a PO for subsidiary A) violates legal procurement terms and breaks financial audit trails. |
| **6. Timesheet / PO Match** | • Optional<br>• Warning<br>• Approval Required<br>• Mandatory 3-way match | **Mandatory 3-way match** | 3-way matching (PO ↔ Timesheet ↔ Invoice) guarantees that we only pay for formally approved hours against an authorized budget. Anything less risks paying for unverified labor. |
| **7. Change Orders / Amendments** | • Unlimited<br>• Approval Required<br>• Version-controlled + audit | **Version-controlled + audit** | Unlimited amendments destroy the integrity of the original budget. Version-controlling changes with explicit audit trails ensures procurement history is unassailable. |
| **8. Emergency Procurement** | • None<br>• Manual override<br>• Dual approval<br>• Time-bound emergency PO | **Dual Approval + Mandatory Emergency PO Shell** | Disallowing emergencies freezes the business in crises, but dual approval alone creates approved spend without a formal procurement artifact. Requiring a time-bound Emergency PO shell ensures an eventual audit trail. |
| **9. Audit / Automation Level** | • Dashboard only<br>• Audit events<br>• Approval workflow<br>• Full automation | **Approval workflow & Audit Events** | Full automation is the eventual goal, but early rollout requires explicit human approval for matching anomalies, backed by strict canonical audit events for traceability. |

## Procurement Lifecycle State Machine

1. **Draft**: Created, unapproved.
2. **Submitted**: Sent for budgetary approval.
3. **Approved**: Budget formally authorized.
4. **Partially Consumed**: Invoices matched and deducted.
5. **Consumed**: Budget fully exhausted.
6. **Expired**: Time limit reached (final reconciliation only).
7. **Closed**: Formally reconciled and locked.

## Next Steps

1. **Review**: Stakeholders review the "Recommended Defaults".
2. **Approve / Modify**: Accept the defaults or select alternate options.
3. **Execute**: Once approved, engineering will incorporate these decisions into the Purchase Order Governance Review Pack and prepare the enforcement architecture.
