# ADR-003: Contractor Lifecycle Governance

## Status
**Proposed / Under Discovery**

## Context & Problem Statement
With the Supplier Renewal Governance framework established (`ADR-002`) and pending execution, we now face the equivalent challenge for individual workforce members: **Contractor Lifecycle Governance**.

While Supplier Governance manages the organization-to-organization legal boundaries, Contractor Governance must manage the day-to-day workforce lifecycle (onboarding, access validity, engagement expiry, and offboarding). Currently, the system lacks a holistic, policy-driven definition of what constitutes a "valid" or "active" contractor, increasing the risk of unauthorized timesheet submission, missing compliance certifications, and orphaned system access.

Following our proven methodology (Visibility → Policy → Enforcement → Automation), this ADR defines the discovery boundaries and open questions necessary to govern the contractor lifecycle.

## Defined Scope
This ADR governs the rules dictating an individual Contractor's system validity, eligibility to bill, and operational status.

*Out of Scope: Automated suspension logic, NATS orchestration, or identity provider offboarding (until policy is finalized).*

---

## Policy Discovery: Open Questions

To establish a governed contractor lifecycle, stakeholders must answer the following core architectural and business questions:

### 1. Determining Contractor Validity
What combination of factors strictly determines whether a Contractor is considered active and eligible to work?
*   **Profile Status:** Is a manual `ACTIVE` status on the profile sufficient?
*   **Active Engagement:** Must the contractor be mapped to an unexpired `Engagement`/`Project`?
*   **Contract Dates:** Does contractor validity terminate the moment their associated `SupplierContract` expires?
*   **Compliance & Certifications:** Do specific lapsed certifications (e.g., security clearance, background checks) instantly invalidate the contractor?
*   **Supplier Dependency:** If the overarching Supplier entity is suspended, do all associated contractors immediately lose validity?

### 2. Event/Expiry Scenarios
What is the desired business outcome for the following lifecycle events?
*   **Engagement Expires:** Does the contractor drop to a `BENCHED` or `SUSPENDED` state, or remain `ACTIVE`?
*   **Supplier Expires:** Does the system lock out the contractor, or merely block their financial transactions?
*   **Certification Lapses:** Does the contractor get a grace period (warning state), or immediate suspension?
*   **Offboarding:** What is the exact cascade of events when a contractor is formally offboarded?

### 3. Operational Enforcement Blocks
Should an expired or invalid contractor be automatically blocked from:
*   Submitting new **timesheets** for hours worked?
*   Having their timesheets rolled into a **supplier invoice**?
*   Being assigned to **new projects/engagements**?
*   Approving or reviewing work (if they hold an approval role)?

### 4. Visibility Requirements
Before enforcing rules, we must expose the data. What visibility tools are required for Ops & HR?
*   **Contractor Expiry Dashboard:** A centralized view of all contractors nearing engagement or compliance expiration.
*   **Engagement Tracking:** Visual badges showing time remaining on active assignments.
*   **Compliance Gaps:** Surfacing missing or expired compliance documentation.
*   **Utilization Anomalies:** Highlighting contractors who are "Active" but have billed zero hours in the last 30/60 days.

### 5. Governance Maturation Path
We will follow the same phased approach used for Suppliers:
*   **Phase 1 (Visibility Only):** Dashboards, badges, and filters to expose risk without changing data.
*   **Phase 2 (Warnings):** Soft UI warnings during timesheet submission or project assignment.
*   **Phase 3 (Audit):** Emitting canonical audit events (e.g., `CONTRACTOR_CERT_EXPIRED`) to the security index.
*   **Phase 4 (Enforcement):** Strict, automated operational blocks and access revocation.

## Consequences
Defining Contractor Lifecycle Governance in parallel with Supplier Governance closes the loop on third-party risk. It ensures we govern both the external entities providing services and the individual human identities executing the work, protecting the organization from compliance violations, unauthorized access, and financial leakage.
