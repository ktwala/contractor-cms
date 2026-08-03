# Hubsec Workforce Platform — Data Import Wizard

## 1. Purpose

The Data Import Wizard provides a guided workflow for onboarding workforce data into Hubsec Workforce Platform.

It is designed primarily for:

- first-time customer onboarding
- migration from spreadsheets or legacy payroll systems
- HR/payroll teams importing large employee datasets
- implementation consultants setting up a new environment

The wizard simplifies the process of:

1. Selecting a dataset
2. Downloading the correct template
3. Uploading a data file
4. Validating the file
5. Approving the import
6. Publishing the data into the platform

This functionality complements the Data Imports Console and does not replace it.

## 2. Relationship to Data Imports Console

| Feature              | Purpose                                      |
| -------------------- | -------------------------------------------- |
| Data Import Wizard   | Guided onboarding flow                       |
| Data Imports Console | Operational monitoring and advanced management |

**Wizard** — Best for: onboarding, first-time imports, guided HR workflows.

**Console** — Best for: reviewing past jobs, debugging imports, exporting errors, re-running imports.

The wizard uses the same backend import pipeline.

## 3. Supported Datasets (v1)

Initial version supports two datasets:

### Employees

Creates employee master records.

Typical fields: `employee_no`, `first_name`, `last_name`, `email`, `hire_date`, `status`

### Employments

Creates employment records for employees.

Typical fields: `employee_no`, `legal_entity_code`, `employment_type`, `effective_from`; `pay_group_code` is optional and enrolls the employment in payroll.

## 4. Wizard Route

Main route: `/enterprise/data-imports/wizard`

Optional dataset routes (future): `/enterprise/data-imports/wizard/employees`, `/enterprise/data-imports/wizard/employments`

## 5. Wizard Steps

The wizard uses a six-step flow:

1. Select Dataset
2. Download Template
3. Upload File
4. Validate
5. Review & Approve
6. Publish

## 6. Step Details

### Step 1 — Select Dataset

Users choose the dataset they want to import.

**UI:** Cards for Employees and Employments, each with description, prerequisites, and recommended usage.

### Step 2 — Download Template

Users download the correct CSV template before uploading data.

**Template location:**

- `/templates/employees_template.csv`
- `/templates/employments_template.csv`

**Employees template — required columns:** `employee_no`, `first_name`, `last_name`, `hire_date`, `status`  
**Optional:** `email`, `national_id`, `phone`, `date_of_birth`, `country`

**Employments template — required columns:** `employee_no`, `legal_entity_code`, `employment_type`, `effective_from`
**Optional payroll column:** `pay_group_code`
**Optional:** `job_title`, `cost_center`, `effective_to`, `notes`

### Step 3 — Upload File

Users upload the CSV file via drag-and-drop.

**API:** `POST /api/enterprise/data-imports/upload` (multipart: `file`, `dataset_type`)

### Step 4 — Validate

Runs validation rules on uploaded data.

**API:** `POST /api/enterprise/data-imports/:jobId/validate`

**UI:** Shows total/valid/warning/error counts; Download errors CSV; View row errors.

### Step 5 — Review & Approve

Users review validation results before approving.

**API:** `POST /api/enterprise/data-imports/:jobId/approve`

### Step 6 — Publish

Publishing writes the validated data into the platform database.

**API:** `POST /api/enterprise/data-imports/:jobId/publish`

**UI:** Progress, final created/updated/skipped counts, success CTAs.

## 7. Dataset Dependencies

The wizard checks dataset prerequisites via:

**API:** `GET /api/enterprise/data-imports/wizard/prerequisites?dataset=EMPLOYMENTS`

**Response:** `ready`, `checks[]` with `key`, `label`, `ready`, `count`, `href`

For Employments, prerequisites: Employees and Legal Entities. Pay Groups are required only for rows that provide `pay_group_code` and are intended for payroll.

## 8. Permissions

The wizard uses the existing data import permissions: `data_import:read`, `data_import:write`, `data_import:approve`, `data_import:publish`.

User can open wizard if they have any of: `data_import:write`, `data_import:approve`, `data_import:publish`.

## 9. Integration with Setup Dashboard

The wizard integrates with the Setup Progress dashboard widget.

Example flow: Create First Admin → Dashboard → Setup Progress → Import Employees → Publish → Setup Progress updates → Import Employments.

## 10. Frontend Component Structure

- `pages/DataImportWizard.tsx`
- `components/data-import-wizard/DatasetSelectStep.tsx`
- `components/data-import-wizard/TemplateStep.tsx`
- `components/data-import-wizard/UploadStep.tsx`
- `components/data-import-wizard/ValidateStep.tsx`
- `components/data-import-wizard/ReviewApproveStep.tsx`
- `components/data-import-wizard/PublishStep.tsx`
- `components/data-import-wizard/WizardStepper.tsx`
- `components/data-import-wizard/HelpPanel.tsx`

## 11. UI Wireframes (Summary)

- **Layout:** Main content (left) + sticky right help panel.
- **Stepper:** 6-step horizontal; states: Completed, Current, Upcoming, Blocked.
- **Help panel:** Current dataset, prerequisites, validation rules, link to Data Imports Console.
- **Colors:** Green = success, Amber = warning, Red = error.

## 12. Future Enhancements

- Additional datasets: Legal Entities, Org Structure, Cost Centers, Positions
- Multi-file import packs, automatic dependency ordering, Excel template validation
