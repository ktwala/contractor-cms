# Supplier Renewal Policy Decision Matrix

This document provides a concise decision framework for business stakeholders to quickly review and approve the governance rules surrounding Supplier Contract Renewals (detailed in `ADR-002`).

Approval of these settings will authorize the engineering team to begin implementing automated enforcement logic and system integrations.

## Decision Matrix

| Decision Area | Options | Recommended Default | Risk / Tradeoff |
| ------------- | ------- | ------------------- | --------------- |
| **1. Expiring Soon Threshold** | • 30 days<br>• 60 days<br>• 90 days | **60 days** | 30 days risks supply chain disruption if renewals take time. 90 days creates alert fatigue. 60 days provides a balanced operational window. |
| **2. Supplier Validity Source of Truth** | • Manual supplier status<br>• Any active contract<br>• Primary contract only | **Any active contract** | Manual status is prone to human error ("zombie suppliers"). "Primary contract" is often too rigid. "Any active" ensures business continuity if a supplier provides multiple services. |
| **3. Expired Contract Impact** | • Visibility only<br>• Warning only<br>• Block new invoices<br>• Block new engagements<br>• Auto-suspend supplier | **Block new invoices & engagements** | "Visibility only" ignores risk. Auto-suspension breaks unrelated workflows for the supplier. Blocking specific transactions strictly enforces compliance on the expired agreement without breaking the whole entity. |
| **4. Missing End Date** | • Allowed indefinitely<br>• Warning<br>• Compliance violation | **Warning** | Banning them entirely breaks legitimate open-ended agreements or historical records. A warning allows tracking and eventual cleanup without punishing the business immediately. |
| **5. Escalation Model** | • 90 / 60 / 30 / expired<br>• Single Threshold | **90 / 60 / 30 / expired** | Single thresholds are easily ignored. Progressive escalation allows distinct intervention strategies (e.g. passive email -> active Slack alert -> executive escalation). |
| **6. Audit Requirements** | • Dashboard only<br>• Audit events<br>• NATS alerts | **Audit events** | Dashboards rely on active checking. Emitting canonical audit events ensures historical compliance and powers downstream automated security alerting when the organization is ready. |
| **7. Automation Level** | • Manual only<br>• Approval workflow<br>• Full automation | **Approval workflow** | "Manual only" creates bottlenecks. "Full automation" is risky early on. A structured approval workflow balances speed with human-in-the-loop oversight. |

## Next Steps

1. **Review**: Stakeholders review the "Recommended Defaults".
2. **Approve / Modify**: Accept the defaults or select an alternate option.
3. **Execute**: Once approved, engineering will convert these decisions into a technical Orchestrator Playbook (via NATS) to begin active enforcement.
