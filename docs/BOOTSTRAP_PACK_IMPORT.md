# Bootstrap Pack Import — Data Requirements

The **Bootstrap Pack Import** is a bulk data ingestion tool designed to set up a customer environment quickly. It accepts either an `.xlsx` workbook or a `.zip` file containing `.csv` files.

---

## File Formats

You can upload one of two file types to the `/v1/api/enterprise/bootstrap-pack/import` endpoint:

1. **Excel Workbook (`.xlsx`)**
   - Each worksheet represents a dataset.
   - Sheet names are matched loosely (spaces and casing are ignored). Valid sheet names include: `Legal Entities`, `Employees`, `Employments`, `Org Units`, etc.

2. **ZIP Archive (`.zip`)**
   - Contains a collection of `.csv` files.
   - Filenames are matched to datasets (e.g., `legal_entities.csv`, `employees.csv`, `pay_groups.csv`).

*Note: Column headers in both formats are automatically normalized to `snake_case` (e.g., "First Name" becomes `first_name`).*

---

## Datasets and Import Order

The importer strictly processes datasets in the following dependency order. If a downstream dataset is provided without its required dependencies, the import for that dataset will be **blocked**.

| Order | Dataset | Hard Dependencies | Description |
|-------|---------|-------------------|-------------|
| 1 | **Legal Entities** | *(None)* | The foundational company structures. |
| 2 | **Pay Groups** | Legal Entities | Payroll grouping configuration. |
| 3 | **Org Units** | Legal Entities | Departments or business units. |
| 4 | **Cost Centers** | Legal Entities | Accounting cost centers. |
| 5 | **Positions** | Org Units | Job roles within the organization. |
| 6 | **Employees** | Legal Entities | Personal employee information. |
| 7 | **Employments** | Employees, Legal Entities | The employment contract details. A Pay Group is optional and only needed for payroll enrollment. |
| 8 | **Employment Assignments** | Employments, Org Units, Cost Centers | Department and cost center assignments. |
| 9 | **Manager Relationships**| Employees | Reporting lines (who manages whom). |

> **Blocking Errors**: If you upload `employees.csv` without also uploading `legal_entities.csv` in the same pack, the Employees dataset will be marked as `blocked` and will fail to import.

---

## Expected Columns (Schema Examples)

Here is a breakdown of the expected columns for the primary datasets. 

### 1. Legal Entities (`legal_entities.csv` / `Legal Entities` sheet)
| Column Header | Required | Notes |
|---------------|----------|-------|
| `code` | **Yes** | Unique identifier for the entity |
| `name` | **Yes** | Full company name |
| `country` | **Yes** | 2-letter country code (e.g., 'ZA', 'LS') |
| `registration_no` | No | Company registration number |
| `tax_reference` | No | Tax identifier |

### 2. Employees (`employees.csv` / `Employees` sheet)
| Column Header | Required | Notes |
|---------------|----------|-------|
| `employee_no` | **Yes** | Unique employee identifier |
| `first_name` | **Yes** | |
| `last_name` | **Yes** | |
| `legal_entity_code` | **Yes** | Binds employee to country/entity |
| `email` | No | Must be a valid email format if provided |
| `phone` | No | |
| `date_of_birth` | No | Valid date format |
| `national_id` | No | ID number / Passport |
| `tax_number` | No | Tax Identification Number (TIN) |
| `residency_status` | No | Defaults to 'RESIDENT' |

*(Other datasets like Pay Groups, Org Units, and Employments follow similar structures, requiring basic linking keys like `code` and descriptive fields).*

---

## Processing Workflow

1. **Upload & Parse**: The system parses the file and maps sheets/CSVs to datasets.
2. **Dependency Check**: It verifies that all hard dependencies are present in the pack.
3. **Row Validation**: It validates every row (e.g., checking for duplicate `code`s or invalid email formats).
4. **Import & Publish**: Valid rows are inserted/updated in the database.
5. **Hierarchy Integrity Check**: If `Employees` or `Manager Relationships` are imported, a post-import check runs to detect cyclical reporting lines, self-managers, or missing managers.
