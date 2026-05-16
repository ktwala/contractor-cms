# Financial Control Policy Decision Matrix

This document provides a concise decision framework for business stakeholders to quickly review and approve the governance rules surrounding Financial Control and Enforcement (detailed in `ADR-004`).

Approval of these settings will authorize the engineering team to begin treating financial workflows (timesheets, invoices) as compliance-aware state machines, strictly bound to Supplier and Contractor lifecycles.

## Decision Matrix

| Decision Area | Options | Recommended Default | Risk / Tradeoff |
| ------------- | ------- | ------------------- | --------------- |
| **1. Expired Contractor Timesheets** | • Allow<br>• Warning<br>• Approval Required<br>• Block<br>• Tiered (Pre vs Post Expiry) | **Tiered: Approval Req. (Pre-expiry work), Hard Block (Post-expiry work)** | Blocking pre-expiry work hurts legitimate submissions, but allowing post-expiry work creates unauthorized labor risk. Tiering prevents unauthorized new labor while safely managing late submissions. |
| **2. Expired Supplier Invoice Submission** | • Allow<br>• Warning<br>• Approval Required<br>• Block | **Block** | If the master supplier agreement is expired, the organization has no legal cover to issue payment. Blocking invoice generation forces the supplier to cure their master contract first. |
| **3. Expired Engagement Billing** | • Allow<br>• Grace Period<br>• Approval Required<br>• Block | **Grace Period (final reconciliation only; no new billable activity)** | Hard blocking immediately upon engagement expiry disrupts the final billing cycle (e.g., month-end close). A structured grace period allows reconciliation of prior work without leaving the engagement open to new work. |
| **4. Mid-Cycle Expiry** *(Valid at start, expires before approval)* | • Ignore<br>• Warning<br>• Approval Required<br>• Hold payment | **Approval Required** | Ignoring it approves invalid spend. Holding payment angers suppliers. Forcing explicit "Approval Required" ensures Finance acknowledges the compliance breach before releasing funds. |
| **5. Retroactive Timesheets** | • Unlimited<br>• 30-day cap<br>• Approval Required<br>• Block after expiry | **30-day cap** | Unlimited retroactive billing destroys financial forecasting and accruals. A strict 30-day cap ensures timely submission while maintaining reasonable operational flexibility. |
| **6. Override Authority** | • Finance only<br>• Ops only<br>• Dual approval<br>• Platform admin | **Dual approval** | Ops knows *why* the work happened; Finance knows the *risk* of paying it. Dual approval ensures operational necessity doesn't override financial compliance in a silo. |
| **7. Audit / Automation Level** | • Dashboard only<br>• Audit events<br>• Approval workflow<br>• Full automation | **Approval workflow & Audit Events** | Full automation on financial blocks can freeze the company. Explicit Audit Events paired with a structured approval workflow creates an unassailable financial paper trail. |
| **8. Billing Grace Period** | • None<br>• 7 days<br>• 30 days<br>• Configurable by org | **7 days** | 30 days is effectively a free month of risk. 7 days provides just enough buffer to execute final administrative wrap-up without exposing the business to significant unauthorized spend. |

## Financial Lifecycle State Machine

1. **Valid**: Flow continues normally.
2. **Warning**: Flagged for operations.
3. **Approval Required**: Requires dual approval for submission.
4. **Financial Hold**: Temporarily paused pending overarching cure.
5. **Blocked**: Systemic rejection of operation.

## Next Steps

1. **Review**: Stakeholders review the "Recommended Defaults".
2. **Approve / Modify**: Accept the defaults or select alternate options.
3. **Execute**: Once approved, engineering will incorporate these decisions into the Financial Governance Review Pack and prepare the technical enforcement architecture.
