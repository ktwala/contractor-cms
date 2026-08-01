# Employee Managers Import

Defines the dataset, validation rules, and publish semantics for onboarding manager hierarchy into the Hubsec Workforce Platform.

This dataset allows organizations migrating from manual HR systems or payroll-only environments to populate reporting relationships required for governance workflows and Identity Governance & Administration (IGA).

## Purpose

Many organizations have reliable payroll data but do not store reporting relationships digitally.

Manager hierarchy is required for:

- Manager-based approvals
- Access certification
- Joiner–Mover–Leaver workflows
- Delegation chains
- Escalation routing
- Identity governance integrations

This import provides a structured way to capture and validate manager relationships before they become the canonical reporting hierarchy.

## Dataset

**Dataset type:** `MANAGER_RELATIONSHIPS` (also referred to as Employee Managers)

Imported using the Data Import Console or Data Import Wizard.

**Pipeline:** Upload → Stage → Validate → Approve → Publish

The final publish updates the canonical field: `Employee.managerId`

## CSV Template

### Minimal Template

```csv
employee_no,manager_employee_no
EMP001,EMP010
EMP002,EMP010
EMP003,EMP011
EMP010,
EMP011,EMP010
```

**Fields:**

| Column             | Required | Description                              |
|--------------------|----------|------------------------------------------|
| employee_no        | Yes      | Employee receiving the manager assignment|
| manager_employee_no| No       | Employee number of the manager           |

If manager_employee_no is empty, the employee will have no manager assigned.

### Generated Template (Recommended)

For manual completion, the platform may generate a richer template:

```csv
employee_no,employee_name,org_unit_name,job_title,manager_employee_no,manager_name
EMP001,Jane Doe,Finance,Analyst,,
EMP002,John Smith,Finance,Clerk,,
EMP003,David Lee,Operations,Officer,,
EMP010,Alice Brown,Finance,Manager,,
EMP011,Sarah White,Operations,Supervisor,,
```

Only `employee_no` and `manager_employee_no` drive publish logic. Other columns assist HR during manual completion.

## Prerequisites

The dataset requires that **Employees** already exist.

Recommended prerequisites:

| Dataset    | Required  | Reason                      |
|------------|-----------|-----------------------------|
| Employees  | Yes       | Manager references depend on employees |
| Employments| Recommended | Enables org-based validation |
| Org Units  | Recommended | Enables hierarchy validation |

## Validation Rules

Validation occurs during the Validate step. Rules are categorized as errors (block publish) and warnings.

### Errors (Blocking)

- **MGR-001** Employee not found — employee_no must exist in Employee table
- **MGR-002** Manager not found — manager_employee_no must exist when provided
- **MGR-003** Self manager — employee_no cannot equal manager_employee_no
- **MGR-004** Duplicate rows — An employee must appear only once in the file
- **MGR-005** Circular hierarchy — Manager relationships must not create reporting loops

### Cycle Detection

Validation considers the combined graph of existing manager assignments in the database and manager relationships in the staged file. Uses depth-first search (DFS) with recursion stack detection.

### Warnings (Non-blocking)

- **MGR-W01** Missing manager — manager_employee_no is empty (valid for top-level roles)
- **MGR-W02** Cross-org relationship — Employee and manager in unrelated org units
- **MGR-W03** Large span of control — Manager has unusually many direct reports (>50)
- **MGR-W04** Deep hierarchy — Hierarchy depth exceeds expected structure (>12 levels)

## Publish Semantics

Publishing updates only employees present in the file. Mode: **PATCH**.

**Case 1 — Manager specified:** Find employee, find manager, set `Employee.managerId = manager.id`

**Case 2 — Manager blank:** Set `Employee.managerId = NULL` for that employee

**Publish result example:**

```json
{
  "updated": 372,
  "cleared": 28,
  "skipped": 0
}
```

## Integration with HR Export

Manager hierarchy is exposed through the HR export API. Derived from `Employee.managerId → manager.employeeNo`.

## HR Export Readiness

Manager completeness contributes to IGA readiness. Statuses: READY, READY_WITH_WARNINGS, NOT_READY.

## Recommended Onboarding Workflow

1. Import Employees
2. Import Employments
3. Download Manager Template
4. HR completes manager assignments
5. Import Manager Hierarchy dataset (MANAGER_RELATIONSHIPS)
6. Validate and fix errors
7. Approve and publish
8. Verify hierarchy
9. Enable HR export / IGA integration

## Canonical Data Model

Final hierarchy stored as: `Employee.managerId → Employee.id`
