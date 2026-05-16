# Contractor Lifecycle Policy Decision Matrix

This document provides a concise decision framework for business stakeholders to quickly review and approve the governance rules surrounding individual Contractor Lifecycles (detailed in `ADR-003`).

Approval of these settings will authorize the engineering team to translate these business decisions into systemic guardrails, beginning with visibility-first tooling and culminating in automated enforcement.

## Decision Matrix

| Decision Area | Options | Recommended Default | Risk / Tradeoff |
| ------------- | ------- | ------------------- | --------------- |
| **1. Contractor Validity Source** | • Profile status<br>• Active engagement<br>• Supplier validity<br>• Certification validity<br>• Combined model | **Combined model** | Relying solely on one attribute allows loopholes (e.g., active profile but expired compliance). A combined model ensures validity is a dynamic computation of Profile + Engagement + Supplier + Compliance. |
| **2. Expiring Soon Threshold** | • 30 days<br>• 60 days<br>• 90 days | **30 days** | Individual engagements and certifications typically renew faster than overarching supplier contracts. A 30-day window balances sufficient warning time with minimal alert fatigue. |
| **3. Engagement Expiry Impact** | • Visibility only<br>• Warning<br>• Block timesheets<br>• Block invoicing<br>• Auto-offboard | **Block timesheets** | Auto-offboarding is too destructive. Allowing timesheets after expiry creates compliance headaches. Blocking timesheets ensures no unauthorized billing occurs post-expiry, forcing operational hygiene. |
| **4. Supplier Expiry Dependency** | • Ignore<br>• Warning<br>• Freeze new activity pending review<br>• Full block | **Freeze new activity pending review** | If the parent supplier loses validity, immediate full freeze may disrupt critical mid-flight projects. Freezing *new* work + approvals but preserving active review and historical records reduces accidental operational shutdown. |
| **5. Certification Expiry** | • Visibility only<br>• Warning<br>• Tiered (Low=Block assignment, High=Full block)<br>• Full operational block | **Tiered Approach** | A lapsed certification (e.g., background check) is a direct risk. Using a tiered approach allows low-risk certs to block new assignments only, while high-risk certs trigger a full operational block (e.g. site/system access revocation). |
| **6. Missing Required Documents** | • Allowed<br>• Warning<br>• Compliance violation | **Compliance violation** | Missing core documents undermines the integrity of the workforce record. Treating it as a violation ensures rapid remediation during onboarding. |
| **7. Audit / Automation Level** | • Dashboard only<br>• Audit events<br>• Approval workflow<br>• Full automation | **Approval workflow & Audit Events** | Full automation without human oversight can incorrectly terminate access. An approval workflow driven by explicit Audit Events balances strict control with essential operational flexibility. |
| **8. Grace Period / Exception Governance** | • None<br>• Manual override only<br>• Time-bound exception with approval | **Time-bound exception with approval** | Governance without exception management becomes brittle. Allowing temporary, time-bound exceptions (e.g., a 14-day grace period for a late background check) keeps operations flowing while maintaining a strict audit trail. |

## Contractor Lifecycle State Machine

1. **Review**: Stakeholders review the "Recommended Defaults".
2. **Approve / Modify**: Accept the defaults or select alternate options.
3. **Execute**: Once approved, engineering will implement the approved model in a phased rollout (Visibility → Warning → Audit → Enforcement).
