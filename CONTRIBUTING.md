# Contributing Guidelines

Welcome to the Contractor CMS platform. As our system governs sensitive access, compliance, and financial data, we enforce rigorous development and architecture standards.

## Governance Doctrine Drift

The platform operates as a unified **Enterprise Policy Decision Platform (PDP)**. Because policy logic is paramount, **no governance surface may evolve independently**.

Treat governance doctrine exactly like code. If business logic changes, you must follow the strict progression model:
**ADR → Decision Matrix → Review Pack → Catalog → Runtime**

Never attempt the reverse.

### Invariants
All governance changes must preserve the schema invariants defined in `docs/security/GOVERNANCE_SCHEMA_INVARIANTS.md`, or you must explicitly amend the governing ADR first. 

The CI pipeline runs a Governance Drift Check (`scripts/governance-drift-check.ts`) on every Pull Request. It will fail if you:
*   Use non-canonical terminology (e.g., `Vendor` instead of `Supplier`).
*   Alter the canonical evaluation order (`Supplier → Contractor → PO → Financial`).
*   Use non-canonical decision outputs or reversibility strings.
*   Emit reason codes, audit events, or permissions that are not formally registered in their respective `.md` catalogs.

If the drift checker fails, your PR will not be merged. Fix the compliance drift in your code or properly update the governing documentation to reflect the new architecture.
