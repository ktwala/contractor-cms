# Connector & governance — PR index

> **Primary engineering TOC:** [`EXTERNAL_WORKFORCE_CAPABILITY_MAP.md`](EXTERNAL_WORKFORCE_CAPABILITY_MAP.md)  
> **Methodology:** [`EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md`](EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md)

Master guide: [`../CONNECTOR_GOVERNANCE_PLATFORM.md`](../CONNECTOR_GOVERNANCE_PLATFORM.md)

## Supplier (Oracle Procurement)

| PR | Document |
|----|----------|
| 1A–1C | [PR-CMS-CONNECTOR-1A-C_ORACLE_PROCUREMENT_REST.md](PR-CMS-CONNECTOR-1A-C_ORACLE_PROCUREMENT_REST.md) |
| 1D–1E | [PR-CMS-CONNECTOR-1D-1E_ORACLE_CONNECTOR_HEALTH.md](PR-CMS-CONNECTOR-1D-1E_ORACLE_CONNECTOR_HEALTH.md) |
| 1F–1G | [PR-CMS-CONNECTOR-1F-1G_ORACLE_CONNECTOR_TELEMETRY.md](PR-CMS-CONNECTOR-1F-1G_ORACLE_CONNECTOR_TELEMETRY.md) |
| CONNECTOR-4 | [PR-CMS-CONNECTOR-4_DRIFT_RECONCILIATION.md](PR-CMS-CONNECTOR-4_DRIFT_RECONCILIATION.md) |
| DATA-2 | [PR-CMS-DATA-2_ORACLE_GOVERNANCE_TWIN.md](PR-CMS-DATA-2_ORACLE_GOVERNANCE_TWIN.md) |

## Workforce (Oracle HCM)

| PR | Document |
|----|----------|
| 1A–1C | [PR-CTR-CONNECTOR-1A-1C_ORACLE_HCM_CONNECTOR.md](PR-CTR-CONNECTOR-1A-1C_ORACLE_HCM_CONNECTOR.md) |
| 1D | [PR-CTR-CONNECTOR-1D_ORACLE_HCM_CONNECTOR_HEALTH.md](PR-CTR-CONNECTOR-1D_ORACLE_HCM_CONNECTOR_HEALTH.md) |
| 1E | [PR-CTR-CONNECTOR-1E_ORACLE_HCM_OPERATIONS.md](PR-CTR-CONNECTOR-1E_ORACLE_HCM_OPERATIONS.md) |
| 1F | [PR-CTR-CONNECTOR-1F_CONTRACTOR_DRIFT_ENGINE.md](PR-CTR-CONNECTOR-1F_CONTRACTOR_DRIFT_ENGINE.md) |
| 1G | [PR-CTR-CONNECTOR-1G_GOVERNANCE_REMEDIATION.md](PR-CTR-CONNECTOR-1G_GOVERNANCE_REMEDIATION.md) |

## Demo

| Doc | Topic |
|-----|--------|
| [PR-DEMO-CONNECTOR-1_MOCK_ORACLE_DEMO_CONTROLS.md](PR-DEMO-CONNECTOR-1_MOCK_ORACLE_DEMO_CONTROLS.md) | Mock Oracle API + UI sync |
| [../CONNECTOR_DEMO_UAT.md](../CONNECTOR_DEMO_UAT.md) | Repeatable demo script |

## RBAC

| Doc | Topic |
|-----|--------|
| [PLATFORM_GOVERNANCE_ROLES.md](PLATFORM_GOVERNANCE_ROLES.md) | PR-RBAC-REALIGN-3 — production roles, seed gaps |
| [PR-RBAC-REALIGN-3A.md](PR-RBAC-REALIGN-3A.md) | Fine-grained permissions + controller guards |
| [PR-RBAC-REALIGN-3B.md](PR-RBAC-REALIGN-3B.md) | Production role bundles — **COMPLETE** |
| [PR-SUPPLIER-PORTAL-INVOICES-1.md](PR-SUPPLIER-PORTAL-INVOICES-1.md) | Supplier portal invoice list — **COMPLETE** |

## Operations

| Doc | Topic |
|-----|--------|
| [EXTERNAL_WORKFORCE_VOCABULARY.md](EXTERNAL_WORKFORCE_VOCABULARY.md) | Business vs implementation terminology (UI + docs) |
| [ADR-012-External-Workforce-Platform-Naming.md](ADR-012-External-Workforce-Platform-Naming.md) | **EWP** product identity — CMS is historical v1 name |
| [EXTERNAL_WORKFORCE_CAPABILITY_MAP.md](EXTERNAL_WORKFORCE_CAPABILITY_MAP.md) | **Primary engineering TOC** — capabilities, evidence, customer mappings |
| [../hubsec-engineering/README.md](../hubsec-engineering/README.md) | **HEM** — engineering discipline (planned Hubsec-level HEM-1.0) |
| [EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md](EXTERNAL_WORKFORCE_CAPABILITY_ENGINEERING_MODEL.md) | HEM **as applied to EWP** — closed loop, governance hierarchy |
| [capabilities/CAP-WORKFORCE-ADMINISTRATION.md](capabilities/CAP-WORKFORCE-ADMINISTRATION.md) | **Reference CAP** — Workforce Administration v1.0 contract |
| [capabilities/CERT-WORKFORCE-ADMINISTRATION.md](capabilities/CERT-WORKFORCE-ADMINISTRATION.md) | CERT — Workforce CAP § conformance **v1.0 PASS** |
| [capabilities/CERT-IDENTITY-ACQUISITION.md](capabilities/CERT-IDENTITY-ACQUISITION.md) | CERT — Identity Acquisition CAP § conformance **v1.0 PASS** |
| [capabilities/CERT-ACCESS-INTEGRATION.md](capabilities/CERT-ACCESS-INTEGRATION.md) | CERT — Access Integration CAP § conformance **v1.0 PASS** |
| [capabilities/README.md](capabilities/README.md) | CAP-* directory |
| [EXTERNAL_WORKFORCE_OPERATING_MODEL_V1.md](EXTERNAL_WORKFORCE_OPERATING_MODEL_V1.md) | Operating doctrine (was Contractor Operating Model) |
| [EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md](EXTERNAL_WORKFORCE_GOVERNANCE_CONSTITUTION_v1.md) | Multi-source governance constitution |
| [EXTERNAL_WORKFORCE_CANONICAL_DATA_MODEL_V1.md](EXTERNAL_WORKFORCE_CANONICAL_DATA_MODEL_V1.md) | Canonical data model |
| [DOMAIN_MODEL_RECOVERY_V1.md](DOMAIN_MODEL_RECOVERY_V1.md) | Frozen domain archaeology — planes, build increment |
| [ADR-011-Contractor-Workforce-Administration-Plane.md](ADR-011-Contractor-Workforce-Administration-Plane.md) | Workforce state machine + events (**APPROVED**) |
| [PR-WORKFORCE-STATE-MODEL-1.md](PR-WORKFORCE-STATE-MODEL-1.md) | `workforceState` column + transition service — **COMPLETE** |
| [PR-WORKFORCE-TRANSITIONS-1.md](PR-WORKFORCE-TRANSITIONS-1.md) | Controlled transition API + matrix — **COMPLETE** |
| [PR-WORKFORCE-NOMINATE-1.md](PR-WORKFORCE-NOMINATE-1.md) | Supplier-backed nominate intake at NOMINATED — **COMPLETE** |
| [PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md](PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1.md) | Portal nomination wiring — **COMPLETE** |
| [PR-WORKFORCE-OPS-REVIEW-1.md](PR-WORKFORCE-OPS-REVIEW-1.md) | Internal ops workforce review queue — **COMPLETE** |
| [PR-WORKFORCE-TIMELINE-FOUNDATION-1.md](PR-WORKFORCE-TIMELINE-FOUNDATION-1.md) | Workforce business timeline (`ContractorWorkforceHistory`) — **COMPLETE** |
| [PR-WORKFORCE-HCM-HISTORY-1.md](PR-WORKFORCE-HCM-HISTORY-1.md) | HCM promote-path bootstrap history (`HCM_BOOTSTRAP`) — **COMPLETE** |
| [PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1.md](PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1.md) | Supplier portal read-only workforce timeline — **COMPLETE** |
| [PR-WORKFORCE-E2E-UAT-1.md](PR-WORKFORCE-E2E-UAT-1.md) | End-to-end workforce administration proof (supplier + ops) — **COMPLETE** |
| [PR-WORKFORCE-REVIEW-OUTCOMES-1.md](PR-WORKFORCE-REVIEW-OUTCOMES-1.md) | Reject, send-back, reopen (`REJECTED` state) — **COMPLETE** |
| [PR-WORKFORCE-BLACKLIST-1.md](PR-WORKFORCE-BLACKLIST-1.md) | CMS workforce blacklist (`BLACKLISTED` policy block) — **COMPLETE** |
| [PR-WORKFORCE-RDS-MAPPING-1.md](PR-WORKFORCE-RDS-MAPPING-1.md) | MTN RDS FE001–FE016 traceability → CMS planes (documentation only) |
| [../SUPPLIER_GOVERNANCE_OPERATIONS.md](../SUPPLIER_GOVERNANCE_OPERATIONS.md) | Governance tiles, evidence authority, approvals API |
| [../CONTRACTOR_BOOTSTRAP_AUTHORITY.md](../CONTRACTOR_BOOTSTRAP_AUTHORITY.md) | HCM bootstrap vs CMS operational authority |
| [../GOVERNANCE_SIGNAL_LIFECYCLE.md](../GOVERNANCE_SIGNAL_LIFECYCLE.md) | Signal category, cutover, decay |
| [PR-GOV-SIGNAL-LIFECYCLE-1.md](PR-GOV-SIGNAL-LIFECYCLE-1.md) | PR slice |
| [../GOVERNANCE_TEST_PERSONAS.md](../GOVERNANCE_TEST_PERSONAS.md) | Test accounts |
| [../DEMO_LOGIN_CREDENTIALS.md](../DEMO_LOGIN_CREDENTIALS.md) | Passwords |
