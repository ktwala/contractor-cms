# PDP Reason Code Catalog

## Status
**Canonical Source of Truth**

## Context
To prevent the Policy Decision Platform (PDP) from emitting ambiguous or unmapped error states ("black-box compliance"), this catalog serves as the absolute authority on PDP Reason Codes.

It maps every permissible reason code to its governance domain, reversibility status, severity, UI rendering rules, and associated Audit Intelligence event.

---

## 1. Governance Drift Rule (Strict Enforcement)
**No PDP reason code may be emitted in the codebase unless it is explicitly defined in this catalog.**

Any attempt by a backend service, orchestrator, or API controller to return a governance rejection string that is not listed below is considered a compliance drift violation and will fail CI checks.

---

## 2. Canonical Registry

### Domain: Supplier Governance
| Reason Code | Reason Category | Operator Role Owner | Reversibility | Severity | Audit Linkage | Default Next Action Template |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SUPPLIER_MASTER_EXPIRED` | LIFECYCLE | Supplier Admin | `REVERSIBLE_AFTER_CURE` | CRITICAL | `SUPPLIER_SUSPENDED_AUTO` | "Supplier Master Agreement expired. Renew supplier contract to unblock operations." |
| `SUPPLIER_NOT_APPROVED` | LIFECYCLE | Operations | `REVERSIBLE_AFTER_CURE` | HIGH | `SUPPLIER_LIFECYCLE_EVENT` | "Supplier onboarding is pending final approval." |
| `SUPPLIER_FROZEN_MANUAL` | COMPLIANCE | Compliance | `REVERSIBLE_AFTER_CURE` | HIGH | `SUPPLIER_LIFECYCLE_EVENT` | "Supplier has been manually frozen by Operations. Contact administrator." |

### Domain: Contractor Governance
| Reason Code | Reason Category | Operator Role Owner | Reversibility | Severity | Audit Linkage | Default Next Action Template |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `CONTRACTOR_FROZEN_SUPPLIER_LAPSE` | LIFECYCLE | Supplier Admin | `REVERSIBLE_AFTER_CURE` | HIGH | `CONTRACTOR_LIFECYCLE_EVENT` | "Contractor frozen due to parent Supplier expiration. Await Supplier renewal." |
| `CONTRACTOR_OFFBOARDED` | LIFECYCLE | Operations | `IRREVERSIBLE_NEW_TRANSACTION_REQUIRED` | CRITICAL | `CONTRACTOR_ACCESS_REVOKED` | "Contractor has been permanently offboarded. Action prohibited." |
| `CERTIFICATION_LAPSED_HIGH` | COMPLIANCE | Compliance | `REVERSIBLE_AFTER_CURE` | CRITICAL | `COMPLIANCE_CERT_EXPIRED` | "Critical certification lapsed. Upload renewed documentation immediately." |
| `CERTIFICATION_LAPSED_LOW` | COMPLIANCE | Compliance | `REVERSIBLE_AFTER_APPROVAL` | WARNING | `COMPLIANCE_CERT_EXPIRED` | "Low-risk certification expired. Request exception or upload renewal." |
| `MISSING_REQUIRED_DOCS` | DOCUMENTATION | Compliance | `REVERSIBLE_AFTER_CURE` | HIGH | `COMPLIANCE_DOC_MISSING` | "Core compliance documents missing. Complete onboarding checklist." |

### Domain: Purchase Order Governance
| Reason Code | Reason Category | Operator Role Owner | Reversibility | Severity | Audit Linkage | Default Next Action Template |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PO_MISSING` | PROCUREMENT | Procurement | `IRREVERSIBLE_NEW_TRANSACTION_REQUIRED` | CRITICAL | `UNAUTHORIZED_SPEND_ATTEMPT` | "Invoice generation blocked: No valid Purchase Order found." |
| `PO_EXPIRED` | LIFECYCLE | Procurement | `IRREVERSIBLE_NEW_TRANSACTION_REQUIRED` | HIGH | `PO_LIFECYCLE_EVENT` | "Purchase Order has expired. New procurement authorization required." |
| `PO_FUNDS_EXHAUSTED` | BUDGET | Finance | `REVERSIBLE_AFTER_APPROVAL` | HIGH | `BUDGET_OVERRUN_ATTEMPT` | "PO budget exceeded. Request amendment or issue new PO." |
| `PO_SUPPLIER_MISMATCH` | PROCUREMENT | Finance | `IRREVERSIBLE_NEW_TRANSACTION_REQUIRED` | CRITICAL | `PROCUREMENT_MISMATCH` | "PO entity does not match the billing entity. Re-issue PO correctly." |

### Domain: Financial Control Governance
| Reason Code | Reason Category | Operator Role Owner | Reversibility | Severity | Audit Linkage | Default Next Action Template |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TIMESHEET_LATE_SUBMISSION` | COMPLIANCE | Operations | `REVERSIBLE_AFTER_APPROVAL` | WARNING | `TIMESHEET_BLOCKED` | "Pre-expiry timesheet submitted late. Managerial dual-approval required." |
| `POST_EXPIRY_LABOR_PROHIBITED`| COMPLIANCE | Operations | `IRREVERSIBLE_NEW_TRANSACTION_REQUIRED` | CRITICAL | `TIMESHEET_BLOCKED` | "Labor logged after contract expiration date is strictly prohibited." |
| `RETROACTIVE_LIMIT_EXCEEDED` | BUDGET | Finance | `REVERSIBLE_AFTER_APPROVAL` | WARNING | `TIMESHEET_BLOCKED` | "Retroactive submission exceeds 30-day cap. Finance approval required." |
| `INVOICE_PO_MISMATCH` | PROCUREMENT | Finance | `IRREVERSIBLE_NEW_TRANSACTION_REQUIRED` | CRITICAL | `INVOICE_BLOCKED` | "3-Way Match failed. Invoice totals do not align with approved timesheets/PO." |

---

## 3. UI Rendering Guidance

When the PDP returns a non-`ALLOW` payload, the frontend application must adhere to the following UI standards:

*   **Human-Readable Output:** The UI must display the explicit `next_action` string. Never display the raw `reason_code` directly to a non-technical end-user.
*   **Irreversible (Hard Blocks):** Render as a persistent red `error` alert without action buttons. Advise the user to abandon the transaction or contact support.
*   **Reversible (Cure):** Render as a yellow `warning` alert. Include a direct deep link to the resource requiring the cure (e.g., link to the Document Upload page).
*   **Reversible (Approval):** Render as an orange `warning` alert. Provide a visible "Request Exception Override" button that triggers the necessary dual-approval workflow.

---

## 4. CI Drift Checks

To guarantee the integrity of this catalog, engineering must implement an automated build script (e.g., `scripts/pdp-catalog-check.ts`) that runs on every Pull Request.

The CI gate will fail if it detects:
1.  **Unknown Reason Codes:** The application codebase (backend API, orchestrator, frontend enums) contains a reason code string not present in this markdown document.
2.  **Duplicate Codes:** A reason code string is defined multiple times or across multiple domains.
3.  **Missing Mappings:** A reason code is defined in the code but lacks a mapped `Severity`, `Reversibility`, or `Default Next Action` in this catalog.
