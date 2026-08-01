# Employee, Employment & Legal Entities — Schema & API Reference

Single reference for: **schema.prisma** (relevant models), **employees** controller/service, **employments** controller/service (separate), and **legal-entities** controller/service (separate). All APIs are under global prefix **`/v1`**.

---

## 1. schema.prisma (current)

### LegalEntity

```prisma
model LegalEntity {
  id             String   @id @default(uuid())
  code           String   @unique
  name           String
  country        Country
  registrationNo String?  @map("registration_no")
  taxReference   String?  @map("tax_reference")
  address        Json?
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  payGroups       PayGroup[]
  employments     Employment[]
  // ... other relations
  @@map("legal_entities")
}
```

- **Identifiers:** `id` (UUID, PK), `code` (unique business key).
- **Enums:** `Country`: LS, ZA.

---

### PayGroup (referenced by Employment)

```prisma
model PayGroup {
  id              String       @id @default(uuid())
  code            String       @unique
  name            String
  country         Country
  currency        Currency
  frequency       PayFrequency
  legalEntityId   String       @map("legal_entity_id")
  defaultCalendar Json?        @map("default_calendar")
  glDefaults      Json?        @map("gl_defaults")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  legalEntity LegalEntity @relation(fields: [legalEntityId], references: [id])
  payPeriods  PayPeriod[]
  employments Employment[]
  // ...
  @@map("pay_groups")
}
```

- **Enums:** `Currency`: LSL, ZAR. `PayFrequency`: WEEKLY, BIWEEKLY, MONTHLY.

---

### Employee

```prisma
model Employee {
  id                String         @id @default(uuid())
  employeeNo        String         @unique @map("employee_no")
  firstName         String         @map("first_name")
  lastName          String         @map("last_name")
  nationalId        String?        @map("national_id")
  email             String?
  phone             String?
  dateOfBirth       DateTime?     @map("date_of_birth") @db.Date
  idType            String?        @map("id_type")
  idNumber          String?        @map("id_number")
  status            EmployeeStatus @default(ACTIVE)
  hireDate          DateTime      @map("hire_date") @db.Date
  terminationDate   DateTime?     @map("termination_date") @db.Date
  endDate           DateTime?     @map("end_date") @db.Date
  userId            String?       @unique @map("user_id")
  salary            Decimal?      @db.Decimal(15, 2)
  department        String?
  jobTitle          String?       @map("job_title")
  managerId         String?       @map("manager_id")
  profilePictureUrl String?       @map("profile_picture_url")
  country           Country?
  legalEntityId     String?       @map("legal_entity_id")
  createdAt         DateTime      @default(now()) @map("created_at")
  updatedAt         DateTime      @updatedAt @map("updated_at")

  user          User?       @relation(fields: [userId], references: [id])
  manager       Employee?   @relation("EmployeeManager", fields: [managerId], references: [id])
  directReports Employee[]  @relation("EmployeeManager")
  employments   Employment[]
  compensations Compensation[]
  bankAccounts  BankAccount[]
  taxProfiles   TaxProfile[]
  // ... leave, documents, performance, etc.
  @@map("employees")
}
```

- **Identifiers:** `id` (UUID, PK), `employee_no` (unique, external/business key).
- **Manager:** `managerId` → `Employee.id` (UUID). No `manager_employee_no`.
- **Enums:** `EmployeeStatus`: ACTIVE, TERMINATED, ON_LEAVE.

---

### Employment

```prisma
model Employment {
  id             String         @id @default(uuid())
  employeeId     String         @map("employee_id")
  legalEntityId  String         @map("legal_entity_id")
  payGroupId     String         @map("pay_group_id")
  country        Country
  jobTitle       String?        @map("job_title")
  costCenter     String?        @map("cost_center")
  employmentType EmploymentType @default(PERMANENT) @map("employment_type")
  effectiveFrom  DateTime       @map("effective_from") @db.Date
  effectiveTo    DateTime?      @map("effective_to") @db.Date
  notes          String?
  createdAt      DateTime       @default(now()) @map("created_at")

  employee    Employee    @relation(fields: [employeeId], references: [id])
  legalEntity LegalEntity @relation(fields: [legalEntityId], references: [id])
  payGroup    PayGroup    @relation(fields: [payGroupId], references: [id])
  @@index([employeeId, effectiveFrom])
  @@map("employments")
}
```

- **Enums:** `EmploymentType`: PERMANENT, CONTRACT, CASUAL.
- **Effective dating:** `effectiveFrom` / `effectiveTo`; null `effectiveTo` = current.

---

### Compensation, BankAccount, TaxProfile (effective-dated, under Employee)

- **Compensation:** `employeeId`, `baseSalary`, `currency`, `effectiveFrom`, `effectiveTo`, `notes`.
- **BankAccount:** `employeeId`, `bankName`, `accountNumberEnc`, `maskedAccountNumber`, `branchCode`, `accountType`, `effectiveFrom`, `effectiveTo`.
- **TaxProfile:** `employeeId`, `country`, `residencyStatus`, `tin`, `effectiveFrom`, `effectiveTo`.

All use `employee_id` (UUID) and have indexes on `(employeeId, effectiveFrom)`.

---

## 2. Employees controller + service

- **Path:** `v1/employees`
- **Controller:** `src/modules/employees/employees.controller.ts`
- **Service:** `src/modules/employees/employees.service.ts`
- **Guards:** JWT + `PermissionsGuard`. Permissions: `employee:read`, `employee:write`; compensation/bank/tax/recurring use their own permission codes.

### Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST   | `/v1/employees` | `employee:write` | Create employee |
| GET    | `/v1/employees` | `employee:read` | List (paginated, filter by status, q, legal_entity_id, pay_group_id) |
| GET    | `/v1/employees/:employee_id` | `employee:read` | Get one by UUID |
| PATCH  | `/v1/employees/:employee_id` | `employee:write` | Update (status, termination_date, email only) |
| GET/POST | `/v1/employees/:employee_id/compensation` | compensation:read/write | List / add compensation |
| GET/POST | `/v1/employees/:employee_id/bank-accounts` | bank_account:read/write | List / add bank account |
| GET/POST | `/v1/employees/:employee_id/tax-profile` | tax_profile:read/write | List / add tax profile |
| GET/POST/DELETE | `/v1/employees/:employee_id/recurring-inputs` | recurring_input:read/write | List / add / deactivate recurring input |

- **`:employee_id`** = internal UUID (`Employee.id`), not `employee_no`.

### Create employee (body)

- **CreateEmployeeDto:** `employee_no` (required), `first_name`, `last_name`, `national_id?`, `status?`, `hire_date`, `termination_date?`, `email?`.
- Service: enforces unique `employee_no`; creates record; audit log; returns `mapToResponse` (no manager/department/jobTitle in response).

### List employees (query)

- **ListEmployeesDto:** `status?`, `legal_entity_id?`, `pay_group_id?`, `q?` (search firstName, lastName, employeeNo, nationalId), `offset`, `limit` (from PaginationDto).
- Filter by employment: current employment only (`effectiveTo: null`) for given legal_entity_id / pay_group_id.

### Patch employee (body)

- **PatchEmployeeDto:** `status?`, `termination_date?`, `email?`. No manager, department, or jobTitle.

### Response shape (employee)

- **EmployeeResponseDto:** `id`, `employee_no`, `first_name`, `last_name`, `national_id?`, `email?`, `status`, `hire_date`, `termination_date?`, `created_at`, `updated_at?`. Manager/department/jobTitle not returned.

---

## 3. Employments controller + service (separate)

- **Path:** `v1/employees` (nested under same `@Controller('employees')` but in **EmploymentsController**).
- **Controller:** `src/modules/employees/employments.controller.ts`
- **Service:** `src/modules/employees/employments.service.ts`
- **Guards:** JWT + PermissionsGuard. Permissions: `employment:write`, `employment:read`.

### Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST   | `/v1/employees/:employee_id/employments` | `employment:write` | Add employment |
| GET    | `/v1/employees/:employee_id/employments` | `employment:read` | List employment history |

### Create employment (body)

- **CreateEmploymentDto:** `legal_entity_id`, `pay_group_id`, `country`, `job_title?`, `cost_center?`, `employment_type?` (default PERMANENT), `effective_from`, `effective_to?`, `notes?`.
- Service:
  - Validates employee exists.
  - Validates legal entity exists and `legal_entity.country === dto.country`.
  - Validates pay group exists and `pay_group.legalEntityId === dto.legal_entity_id`.
  - If employee has an open employment (`effectiveTo: null`), closes it with `effectiveTo = effective_from - 1 day`.
  - Creates employment; audit log; returns `mapToResponse`.

### List employments (response)

- **EmploymentHistoryResponseDto:** `{ items: EmploymentResponseDto[] }`.
- **EmploymentResponseDto:** `id`, `employee_id`, `legal_entity_id`, `pay_group_id`, `country`, `job_title?`, `cost_center?`, `employment_type`, `effective_from`, `effective_to?`, `notes?`, `created_at`, `current_assignment?`, `next_assignment?`.
- **Query:** `include_assignments` (optional, boolean) — when `true`, each item includes full `assignments` array (assignment history). Default returns only `current_assignment` and `next_assignment`.
- **current_assignment:** derived org unit + cost center effective today; null if none.
- **next_assignment:** earliest future assignment (effective_from > today); null if none. Enables "planned change" / JML mover scenarios.
- Ordered by `effectiveFrom` desc.

### "Today" / timezone for assignment logic

- **Effective-date comparison** uses server date: `today` is `new Date()` with `setHours(0,0,0,0)` (local server timezone).
- For multi-tenant deployments spanning timezones, define "today" consistently (e.g. tenant timezone or UTC) and document it. Otherwise assignments can flip early/late around midnight.
- **Recommendation:** Document tenant timezone in deployment config; consider adding `as_of` query support for point-in-time assignment resolution.

### Service methods used elsewhere

- **getCurrentEmployment(employeeId, asOfDate?):** returns raw current employment (effectiveFrom ≤ date and effectiveTo null or ≥ date) with `legalEntity` and `payGroup`. Not exposed as HTTP endpoint.
- **getCurrentEmploymentEnriched(employeeId, asOfDate?):** returns mapped employment with `current_assignment` and `next_assignment`. Used by HR export and IGA.

---

## 4. Legal-entities controller + service (separate)

- **Path:** `v1/legal-entities`
- **Controller:** `src/modules/legal-entities/legal-entities.controller.ts`
- **Service:** `src/modules/legal-entities/legal-entities.service.ts`
- **Guards:** JWT + PermissionsGuard. Permissions: `legal_entity:read`, `legal_entity:write`.

### Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST   | `/v1/legal-entities` | `legal_entity:write` | Create legal entity |
| GET    | `/v1/legal-entities` | `legal_entity:read` | List (paginated, optional country filter) |
| GET    | `/v1/legal-entities/:legal_entity_id` | `legal_entity:read` | Get one by UUID |

- **`:legal_entity_id`** = internal UUID (`LegalEntity.id`).

### Create legal entity (body)

- **CreateLegalEntityDto:** `code` (required), `name`, `country`, `registration_no?`, `tax_reference?`, `address?` (object).
- Service: enforces unique `code`; creates record; audit log; returns `mapToResponse`.

### List legal entities (query)

- **ListLegalEntitiesDto:** extends PaginationDto; `country?` (enum). Service: filter by country if set; order by `createdAt` desc.

### Response shape

- **LegalEntityResponseDto:** `id`, `code`, `name`, `country`, `registration_no?`, `tax_reference?`, `address?`, `created_at`.
- **PaginatedLegalEntitiesDto:** `items`, `offset`, `limit`, `total`.

### Service method (no HTTP route)

- **findByCode(code):** returns legal entity by `code`. Used internally if needed.

---

## 5. File locations

| Layer | Employee | Employment | Legal entities |
|-------|----------|------------|----------------|
| **Controller** | `src/modules/employees/employees.controller.ts` | `src/modules/employees/employments.controller.ts` | `src/modules/legal-entities/legal-entities.controller.ts` |
| **Service** | `src/modules/employees/employees.service.ts` | `src/modules/employees/employments.service.ts` | `src/modules/legal-entities/legal-entities.service.ts` |
| **Create DTO** | `dto/create-employee.dto.ts` | `dto/create-employment.dto.ts` | `dto/create-legal-entity.dto.ts` |
| **List DTO** | `dto/list-employees.dto.ts` | — | `dto/list-legal-entities.dto.ts` |
| **Response DTO** | `dto/employee-response.dto.ts` | `dto/employment-response.dto.ts` | `dto/legal-entity-response.dto.ts` |
| **Schema** | `Employee` (+ Compensation, BankAccount, TaxProfile) | `Employment` | `LegalEntity` (+ PayGroup) |

---

## 6. Identifiers summary

| Entity | Primary key (DB) | External/business key | API path param | Manager linkage |
|--------|-------------------|------------------------|----------------|-----------------|
| **Employee** | `id` (UUID) | `employee_no` (unique) | `:employee_id` = UUID | `managerId` → Employee.id (UUID). Not in API. |
| **Employment** | `id` (UUID) | — | — | — |
| **LegalEntity** | `id` (UUID) | `code` (unique) | `:legal_entity_id` = UUID | — |

All path params and FKs use **internal UUIDs** (`id`). External identifiers for reference/IGA: **employee_no**, **legal entity code**.
