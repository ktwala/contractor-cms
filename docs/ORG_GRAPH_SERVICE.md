# Org Graph Service

The Org Graph Service builds and maintains an in-memory representation of the organizational hierarchy derived from employee reporting relationships.

The service powers approval routing, identity governance workflows, hierarchy validation, direct/indirect report queries, and organizational visualizations.

## Purpose

The employee table stores reporting relationships using `Employee.managerId`. While simple, querying reporting chains repeatedly through SQL is inefficient. The Org Graph Service constructs a graph model enabling fast hierarchy traversal.

## Canonical Data Model

```text
Employee
 ├─ id
 ├─ employeeNo
 └─ managerId → Employee.id
```

## Graph Model

Internal structure: `employeeId → { managerId, reports[] }`

- **getManager(employeeId)** — O(1)
- **getDirectReports(managerId)** — O(1)
- **getManagerChain(employeeId)** — O(depth)
- **getAllReports(managerId)** — O(n subtree)

## Core Queries

- **getManager** — Return an employee's manager
- **getDirectReports** — Employees reporting directly to a manager
- **getAllReports** — All employees in a manager's hierarchy (for approvals, certification)
- **getManagerChain** — Approval chain (Employee → Manager → Director → CEO)
- **getOrgRoot** — Top of reporting chain
- **getHierarchyDepth** — Maximum depth in the hierarchy

## Graph Refresh

The graph is rebuilt when:

- On first access
- After cache TTL (configurable)
- When `invalidateCache()` is called (e.g. after manager import publish)

## Integration Points

- **Approval workflows** — Manager chain for routing
- **Identity governance** — IGA manager approval resolution
- **Delegation** — Escalation to next manager
- **Certification campaigns** — Manager reviews direct/indirect reports
- **Hierarchy integrity** — Feeds HierarchyIntegrityService for cycle/depth/span checks

## Implementation

**OrgGraphService** — `src/modules/hierarchy/org-graph.service.ts`

- `buildGraph(force?)` — Load employees, build adjacency
- `getManager()`, `getDirectReports()`, `getAllReports()`, `getManagerChain()`, `getOrgRoot()`, `getHierarchyDepth()`
- `invalidateCache()` — Force rebuild on next access

## Architecture Role

```
Employees table      → canonical hierarchy storage
Org Graph Service    → hierarchy computation engine
Integrity Engine     → hierarchy validation
IGA                  → governance consumer
```

## Strategic Note

Once this exists, the platform can answer governance questions instantly: who can approve, who owns this department, who should review this access. This matches how enterprise identity governance platforms derive approval chains.
