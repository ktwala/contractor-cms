# Manager Hierarchy Integrity Engine

The Manager Hierarchy Integrity Engine continuously validates the organizational reporting structure stored in `Employee.managerId`.

The engine ensures the hierarchy is safe for manager-based approvals, Identity Governance workflows, delegation chains, escalation routing, and HR export integrations.

## Purpose

Organizations onboarding from payroll-only or manual HR systems often introduce errors in manager relationships. Common issues include:

- Employees without managers
- Reporting cycles
- Cross-entity reporting
- Broken approval chains
- Extreme spans of control

The integrity engine detects these conditions and surfaces them in dashboard widgets, HR export readiness, and operational alerts.

## Validation Categories

| Category      | Purpose                            |
|---------------|------------------------------------|
| Structure     | Detect cycles and orphan nodes      |
| Coverage      | Detect employees missing managers  |
| Org alignment | Validate reporting inside org boundaries |
| Span          | Detect unusually large teams       |
| Depth         | Detect abnormal hierarchy depth    |

## Core Structural Rules (CRITICAL)

- **HIER-001** Circular Reporting — DFS cycle detection. Blocks HR export readiness.
- **HIER-002** Self-manager — Employee cannot report to themselves
- **HIER-003** Orphan Manager — Manager reference exists but manager record does not

## Coverage Rules (WARNING)

- **HIER-010** Missing Manager — Valid for CEO/top-level roles; should not occur for large numbers of employees

## Organizational Alignment (WARNING)

- **HIER-020** Cross Legal Entity Manager
- **HIER-021** Cross Org Unit Manager

## Span & Depth (WARNING)

- **HIER-030** Large Span of Control — >50 direct reports
- **HIER-040** Excessive Hierarchy Depth — >12 levels

## Implementation

The engine is implemented as:

- **HierarchyIntegrityService** — `getReport()`, cycle detection, depth/span calculation
- **OrgGraphService** — In-memory graph, `buildGraph()`, `getHierarchyDepth()`, `getDirectReports()`

Runs on HR export readiness checks and can be triggered after manager import publish.

## Integration

- **Dashboard** — Manager hierarchy metrics in HR Export Readiness widget
- **HR Export Readiness** — Block when `cycles_detected > 0`
- **Operational alerts** — Can trigger on critical issues

## Onboarding Lifecycle

```
Bootstrap admin
    ↓
Setup organisation
    ↓
Import employees
    ↓
Import employments
    ↓
Import manager hierarchy
    ↓
Hierarchy integrity validation
    ↓
HR export readiness
    ↓
IGA integration
```

## Canonical Data Model

`Employee.managerId → Employee.id` — simple adjacency model for queries, traversal, and export.
