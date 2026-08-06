# Supplier Renewal Governance Review Pack

## 1. Executive Summary

### Problem
Historically, supplier and contract renewals have been treated as static data entries rather than a governed lifecycle. Contracts are signed with explicit `endDate`s, but the system relies entirely on manual human intervention to monitor, flag, and action those expirations.

### Operational Risk
If a contract expires without system awareness, the supplier technically remains `ACTIVE`. This creates "zombie suppliers" who can continue submitting invoices or receiving new project engagements despite having no valid legal agreement in place. This poses a significant compliance and financial risk.

### Why the Current Manual State is Insufficient
Manual operations scale poorly. As the organization signs hundreds of new suppliers, relying on manual CSV exports and ad-hoc calendar reminders inevitably leads to dropped renewals, unapproved spend, and audit failures. The system must natively govern the renewal lifecycle.

---

## 2. Current Capability (Delivered)

Engineering has already deployed the **Visibility Layer** to production. The system now surfaces expiration risk without automatically altering data or disrupting operations.

*   **Contract Expiry Logic:** Centralized, timezone-safe date architecture tracking exact days remaining on every contract.
*   **Visibility Features Delivered:** Dynamic `ValidityBadge`s (Active, Expiring Soon, Expired) on the main Contracts table.
*   **Dashboard Widgets:** A real-time `ContractRenewalsWidget` mounted on executive and operational dashboards summarizing contracts expiring in <30 days, <90 days, and those already expired.
*   **Filters:** Scalable, backend-supported query filters allowing operators to instantly isolate expiring contracts.

---

## 3. Policy Decisions Required

Before engineering can automate the enforcement of these expirations, stakeholders must approve the overarching governance rules.

**Unresolved Stakeholder Choices (from `SUPPLIER_RENEWAL_POLICY_DECISION_MATRIX.md`):**

| Decision Area | Options |
| ------------- | ------- |
| **1. Expiring Soon Threshold** | 30 days / 60 days / 90 days |
| **2. Supplier Validity Source** | Manual status / Any active contract / Primary contract |
| **3. Expired Contract Impact** | Visibility only / Warning only / Block invoices / Block engagements / Auto-suspend |
| **4. Missing End Date** | Allowed indefinitely / Warning / Compliance violation |
| **5. Escalation Model** | 90-60-30-expired / Single threshold |
| **6. Audit Requirements** | Dashboard only / Audit events / NATS alerts |
| **7. Automation Level** | Manual only / Approval workflow / Full automation |

---

## 4. Recommended Default Path

Engineering and Architecture recommend the following default path to balance operational continuity with strict compliance:

*   **Threshold & Escalation:** Use **60 days** as the baseline warning threshold, but implement progressive escalation (90-day info, 60-day warning, 30-day alert). This prevents alert fatigue while ensuring nothing falls through the cracks.
*   **Validity & Impact:** Supplier validity should rely on **Any Active Contract**. If a specific contract expires, we **Block new invoices & engagements** against *that specific contract*, but do not auto-suspend the entire supplier entity.
*   **Audit & Automation:** Expirations must emit canonical **Audit Events**, and renewals should follow a governed **Approval Workflow** rather than full unmonitored automation.

**Why this works:** It safely isolates risk. If one contract expires, compliance is enforced by blocking invoices on that specific agreement, but the supplier can continue working on their other active projects without disruption.

---

## 5. Execution Readiness

Once the policy decisions are approved, engineering is positioned for immediate execution via the pre-approved **Automation Execution Plan**:

*   **Summary:** A daily scheduled NATS job will evaluate all contracts, categorize them into time-bounds (90/60/30/Expired), and route canonical events through the Audit layer.
*   **Safety Controls:** Enforcement logic will be wrapped in a global `ENABLE_RENEWAL_ENFORCEMENT` feature flag and will initially run in "Dry-Run" mode (emitting shadow logs without blocking actual operations).
*   **Rollback Options:** The system supports org-by-org selective rollout and provides a manual override path for Operations admins to manually extend contracts during disputes.

---

## 6. Approval Checklist

To proceed to the Automation build phase (NATS orchestration), the following signatures are required to finalize the policy:

- [ ] **Business Owner** (Approves operational impact and escalation models)
- [ ] **Compliance / Legal** (Approves invoice blocking and audit trails)
- [ ] **Operations** (Approves visibility features and manual override capabilities)
- [ ] **Security** (Approves Audit Intelligence integration)
