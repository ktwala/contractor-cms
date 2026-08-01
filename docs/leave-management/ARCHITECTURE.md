# Leave Management Module - Architecture

This document describes the architecture of the Leave Management module, designed for multi-country extensibility.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Architecture Overview](#architecture-overview)
3. [Country Pack Pattern](#country-pack-pattern)
4. [Data Model](#data-model)
5. [Service Layer](#service-layer)
6. [Payroll Integration](#payroll-integration)
7. [Adding New Countries](#adding-new-countries)

---

## Design Principles

### 1. Country-Agnostic Core
The core leave management logic is country-agnostic. Country-specific rules are injected via the Country Pack pattern.

### 2. Configuration over Code
Leave policies are data-driven. Adding a new country should require minimal code changes - primarily configuration and policy definitions.

### 3. Separation of Concerns
```
┌─────────────────────────────────────────────────────────────────┐
│                      LEAVE MODULE LAYERS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CONTROLLER LAYER                      │    │
│  │         REST APIs, Request/Response handling             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    SERVICE LAYER                         │    │
│  │      Core leave logic (balance, requests, accruals)      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 COUNTRY PACK LAYER                       │    │
│  │     Country-specific rules, policies, calculations       │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │    │
│  │  │   ZA    │  │   LS    │  │   BW    │  │   NA    │     │    │
│  │  │  Pack   │  │  Pack   │  │  Pack   │  │  Pack   │     │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  REPOSITORY LAYER                        │    │
│  │              Prisma ORM, Database access                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Policy-Based Validation
Leave rules are expressed as policies that can be composed and extended:

```typescript
interface LeavePolicy {
  canRequest(context: LeaveRequestContext): PolicyResult;
  calculateEntitlement(context: EntitlementContext): number;
  calculateAccrual(context: AccrualContext): number;
  calculatePayImpact(context: PayContext): PayAdjustment;
}
```

---

## Architecture Overview

### Module Structure

```
src/
├── modules/
│   └── leave/
│       ├── dto/
│       │   ├── leave-type.dto.ts
│       │   ├── leave-balance.dto.ts
│       │   ├── leave-request.dto.ts
│       │   ├── leave-accrual.dto.ts
│       │   └── leave-policy.dto.ts
│       │
│       ├── entities/
│       │   └── (Prisma models handle this)
│       │
│       ├── services/
│       │   ├── leave.service.ts           # Main orchestration
│       │   ├── leave-balance.service.ts   # Balance calculations
│       │   ├── leave-accrual.service.ts   # Accrual engine
│       │   ├── leave-request.service.ts   # Request workflow
│       │   ├── leave-calendar.service.ts  # Public holidays
│       │   └── leave-payroll.service.ts   # Payroll integration
│       │
│       ├── policies/
│       │   ├── leave-policy.interface.ts  # Policy contracts
│       │   ├── base-leave.policy.ts       # Shared logic
│       │   └── policy-engine.ts           # Policy executor
│       │
│       ├── leave.controller.ts
│       ├── leave.module.ts
│       └── index.ts
│
└── country-packs/
    ├── country-packs.module.ts
    ├── base/
    │   └── leave-policy.base.ts
    │
    ├── za/
    │   ├── leave/
    │   │   ├── za-leave.policy.ts
    │   │   ├── za-leave.config.ts
    │   │   └── za-public-holidays.ts
    │   └── ...
    │
    └── ls/
        ├── leave/
        │   ├── ls-leave.policy.ts
        │   ├── ls-leave.config.ts
        │   └── ls-public-holidays.ts
        └── ...
```

---

## Country Pack Pattern

### Interface Definition

Each country pack implements a standard interface for leave:

```typescript
// src/country-packs/base/leave-policy.interface.ts

export interface ICountryLeavePack {
  readonly countryCode: Country;

  // Configuration
  getLeaveConfig(): CountryLeaveConfig;
  getPublicHolidays(year: number): PublicHoliday[];

  // Entitlement Calculations
  calculateAnnualEntitlement(employee: Employee, asOfDate: Date): number;
  calculateSickEntitlement(employee: Employee, cycleStart: Date): number;
  calculateMaternityEntitlement(employee: Employee): MaternityEntitlement;
  calculatePaternityEntitlement(employee: Employee): PaternityEntitlement;

  // Accrual Rules
  calculateMonthlyAccrual(
    employee: Employee,
    leaveType: LeaveType,
    period: PayPeriod
  ): AccrualResult;

  // Validation Rules
  validateLeaveRequest(request: LeaveRequest): ValidationResult;

  // Pay Impact
  calculatePayDeduction(
    employee: Employee,
    leaveType: LeaveType,
    days: number
  ): PayDeduction;

  // Termination
  calculateTerminationPayout(
    employee: Employee,
    terminationDate: Date,
    balances: LeaveBalance[]
  ): TerminationPayout;
}
```

### South Africa Implementation

```typescript
// src/country-packs/za/leave/za-leave.policy.ts

@Injectable()
export class ZALeavePack implements ICountryLeavePack {
  readonly countryCode = Country.ZA;

  getLeaveConfig(): CountryLeaveConfig {
    return {
      workingDaysPerMonth: 21.67,
      workingHoursPerDay: 8,

      annualLeave: {
        entitlementDays: 15,          // Working days
        accrualRatePerMonth: 1.25,
        qualifyingMonths: 0,           // Immediate
        maxCarryOverDays: 15,
        carryOverExpiryMonths: 6,
        payoutOnTermination: true,
      },

      sickLeave: {
        entitlementDays: 30,
        cyclePeriodYears: 3,
        certificateRequiredAfterDays: 2,
        accumulatesAcrossCycles: false,
      },

      maternityLeave: {
        entitlementWeeks: 17.32,       // 4 months
        employerPaidPercentage: 0,     // Unpaid
        socialInsuranceClaim: true,    // UIF
        socialInsurancePercentage: 66,
      },

      paternityLeave: {
        entitlementDays: 10,
        employerPaidPercentage: 0,
        socialInsuranceClaim: true,
      },

      familyResponsibilityLeave: {
        entitlementDays: 3,
        validReasons: [
          'CHILD_BIRTH',
          'CHILD_ILLNESS',
          'FAMILY_DEATH',
        ],
      },
    };
  }

  calculateAnnualEntitlement(employee: Employee, asOfDate: Date): number {
    const config = this.getLeaveConfig().annualLeave;
    const monthsEmployed = this.calculateMonthsEmployed(employee, asOfDate);

    // ZA: Accrues from day 1
    return Math.floor(monthsEmployed * config.accrualRatePerMonth);
  }

  calculatePayDeduction(
    employee: Employee,
    leaveType: LeaveType,
    days: number
  ): PayDeduction {
    // ZA: Maternity is unpaid (employee claims from UIF)
    if (leaveType === LeaveType.MATERNITY) {
      return {
        deductionType: 'FULL',
        days,
        amount: this.calculateDailyRate(employee) * days,
        note: 'Employee may claim from UIF',
      };
    }

    // Unpaid leave deduction
    if (leaveType === LeaveType.UNPAID) {
      return {
        deductionType: 'FULL',
        days,
        amount: this.calculateDailyRate(employee) * days,
      };
    }

    // Paid leave types
    return { deductionType: 'NONE', days, amount: 0 };
  }

  private calculateDailyRate(employee: Employee): number {
    return employee.monthlySalary / 21.67;
  }
}
```

### Lesotho Implementation

```typescript
// src/country-packs/ls/leave/ls-leave.policy.ts

@Injectable()
export class LSLeavePack implements ICountryLeavePack {
  readonly countryCode = Country.LS;

  getLeaveConfig(): CountryLeaveConfig {
    return {
      workingDaysPerMonth: 22,
      workingHoursPerDay: 8,

      annualLeave: {
        entitlementDays: 12,
        accrualRatePerMonth: 1,
        qualifyingMonths: 12,          // Must complete 1 year
        maxCarryOverDays: 12,
        carryOverExpiryMonths: 12,
        payoutOnTermination: true,
      },

      sickLeave: {
        entitlementDays: 14,
        cyclePeriodYears: 1,           // Resets annually
        certificateRequiredAfterDays: 3,
        accumulatesAcrossCycles: false,
      },

      maternityLeave: {
        entitlementWeeks: 12,
        employerPaidPercentage: 66.67, // Employer pays 2/3
        socialInsuranceClaim: false,   // No UIF
        socialInsurancePercentage: 0,
      },

      paternityLeave: {
        entitlementDays: 0,            // No statutory
        employerPaidPercentage: 0,
        socialInsuranceClaim: false,
      },

      familyResponsibilityLeave: {
        entitlementDays: 0,            // No statutory
        validReasons: [],
      },
    };
  }

  calculateAnnualEntitlement(employee: Employee, asOfDate: Date): number {
    const config = this.getLeaveConfig().annualLeave;
    const monthsEmployed = this.calculateMonthsEmployed(employee, asOfDate);

    // LS: Must complete 12 months first
    if (monthsEmployed < config.qualifyingMonths) {
      return 0;
    }

    // Calculate completed years after qualifying period
    const qualifiedMonths = monthsEmployed - config.qualifyingMonths;
    const completedYears = Math.floor(qualifiedMonths / 12);
    const currentYearMonths = qualifiedMonths % 12;

    return (completedYears * config.entitlementDays) +
           Math.floor(currentYearMonths * config.accrualRatePerMonth);
  }

  calculatePayDeduction(
    employee: Employee,
    leaveType: LeaveType,
    days: number
  ): PayDeduction {
    // LS: Maternity is 66.67% paid by employer
    if (leaveType === LeaveType.MATERNITY) {
      const dailyRate = this.calculateDailyRate(employee);
      const paidAmount = dailyRate * days * 0.6667;
      const deductionAmount = dailyRate * days * 0.3333;

      return {
        deductionType: 'PARTIAL',
        days,
        amount: deductionAmount,
        paidAmount,
        note: 'Employer pays 66.67% during maternity',
      };
    }

    // Unpaid leave
    if (leaveType === LeaveType.UNPAID) {
      return {
        deductionType: 'FULL',
        days,
        amount: this.calculateDailyRate(employee) * days,
      };
    }

    return { deductionType: 'NONE', days, amount: 0 };
  }

  private calculateDailyRate(employee: Employee): number {
    return employee.monthlySalary / 22;
  }
}
```

---

## Data Model

### Prisma Schema

```prisma
// Leave Types (configured per organization, with country defaults)
model LeaveType {
  id              String    @id @default(uuid())
  organizationId  String    @map("organization_id")
  country         Country
  code            String    // ANNUAL, SICK, MATERNITY, etc.
  name            String
  description     String?

  // Entitlement
  defaultEntitlement    Decimal   @map("default_entitlement") @db.Decimal(5, 2)
  entitlementUnit       String    @default("DAYS") @map("entitlement_unit") // DAYS, HOURS

  // Accrual
  accrualRate           Decimal   @map("accrual_rate") @db.Decimal(5, 2)
  accrualFrequency      String    @default("MONTHLY") @map("accrual_frequency")
  accrualStartMonth     Int       @default(0) @map("accrual_start_month")

  // Carry Over
  allowCarryOver        Boolean   @default(true) @map("allow_carry_over")
  maxCarryOverDays      Decimal?  @map("max_carry_over_days") @db.Decimal(5, 2)
  carryOverExpiryMonths Int?      @map("carry_over_expiry_months")

  // Payment
  isPaid                Boolean   @default(true) @map("is_paid")
  paidPercentage        Decimal   @default(100) @map("paid_percentage") @db.Decimal(5, 2)
  payoutOnTermination   Boolean   @default(false) @map("payout_on_termination")

  // Validation
  requiresApproval      Boolean   @default(true) @map("requires_approval")
  requiresCertificate   Boolean   @default(false) @map("requires_certificate")
  certificateAfterDays  Int?      @map("certificate_after_days")
  minNoticeDays         Int       @default(0) @map("min_notice_days")
  maxConsecutiveDays    Int?      @map("max_consecutive_days")

  // Negative Balance
  allowNegativeBalance  Boolean   @default(false) @map("allow_negative_balance")
  maxNegativeDays       Decimal?  @map("max_negative_days") @db.Decimal(5, 2)

  // Cycle
  cycleType             String    @default("CALENDAR_YEAR") @map("cycle_type")
  cycleLengthYears      Int       @default(1) @map("cycle_length_years")

  // Status
  isActive              Boolean   @default(true) @map("is_active")
  isStatutory           Boolean   @default(false) @map("is_statutory")
  sortOrder             Int       @default(100) @map("sort_order")

  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  balances              LeaveBalance[]
  requests              LeaveRequest[]
  accruals              LeaveAccrual[]
  policies              LeavePolicy[]

  @@unique([organizationId, country, code])
  @@index([organizationId, isActive])
  @@map("leave_types")
}

// Leave Balances (per employee, per leave type)
model LeaveBalance {
  id              String    @id @default(uuid())
  employeeId      String    @map("employee_id")
  leaveTypeId     String    @map("leave_type_id")

  // Current Cycle
  cycleStartDate  DateTime  @map("cycle_start_date") @db.Date
  cycleEndDate    DateTime  @map("cycle_end_date") @db.Date

  // Balances
  openingBalance  Decimal   @default(0) @map("opening_balance") @db.Decimal(7, 2)
  accrued         Decimal   @default(0) @db.Decimal(7, 2)
  taken           Decimal   @default(0) @db.Decimal(7, 2)
  pending         Decimal   @default(0) @db.Decimal(7, 2)  // Approved but not yet taken
  adjustment      Decimal   @default(0) @db.Decimal(7, 2)
  forfeited       Decimal   @default(0) @db.Decimal(7, 2)

  // Calculated field (stored for performance)
  currentBalance  Decimal   @default(0) @map("current_balance") @db.Decimal(7, 2)

  // Carry Over Tracking
  carryOverBalance   Decimal   @default(0) @map("carry_over_balance") @db.Decimal(7, 2)
  carryOverExpiresAt DateTime? @map("carry_over_expires_at") @db.Date

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  employee        Employee  @relation(fields: [employeeId], references: [id])
  leaveType       LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@unique([employeeId, leaveTypeId, cycleStartDate])
  @@index([employeeId])
  @@map("leave_balances")
}

// Leave Requests
model LeaveRequest {
  id              String    @id @default(uuid())
  employeeId      String    @map("employee_id")
  leaveTypeId     String    @map("leave_type_id")

  // Request Details
  startDate       DateTime  @map("start_date") @db.Date
  endDate         DateTime  @map("end_date") @db.Date
  startHalf       String?   @map("start_half") // AM, PM, FULL
  endHalf         String?   @map("end_half")
  totalDays       Decimal   @map("total_days") @db.Decimal(5, 2)
  totalHours      Decimal?  @map("total_hours") @db.Decimal(7, 2)

  // Reason
  reason          String?

  // Supporting Documents
  certificateRequired   Boolean   @default(false) @map("certificate_required")
  certificateUploaded   Boolean   @default(false) @map("certificate_uploaded")
  certificateUrl        String?   @map("certificate_url")

  // Status
  status          String    @default("PENDING") // PENDING, APPROVED, REJECTED, CANCELLED

  // Workflow
  submittedAt     DateTime  @default(now()) @map("submitted_at")
  submittedBy     String    @map("submitted_by")
  reviewedAt      DateTime? @map("reviewed_at")
  reviewedBy      String?   @map("reviewed_by")
  reviewComment   String?   @map("review_comment")
  cancelledAt     DateTime? @map("cancelled_at")
  cancelledBy     String?   @map("cancelled_by")
  cancelReason    String?   @map("cancel_reason")

  // Payroll Impact
  affectsPayroll  Boolean   @default(false) @map("affects_payroll")
  payrunId        String?   @map("payrun_id")
  deductionAmount Decimal?  @map("deduction_amount") @db.Decimal(15, 2)

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  employee        Employee  @relation(fields: [employeeId], references: [id])
  leaveType       LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@index([employeeId, status])
  @@index([startDate, endDate])
  @@map("leave_requests")
}

// Leave Accruals (transaction log)
model LeaveAccrual {
  id              String    @id @default(uuid())
  employeeId      String    @map("employee_id")
  leaveTypeId     String    @map("leave_type_id")

  // Accrual Details
  accrualDate     DateTime  @map("accrual_date") @db.Date
  accrualType     String    @map("accrual_type") // MONTHLY, ANNUAL, ADJUSTMENT, CARRY_OVER, FORFEIT
  amount          Decimal   @db.Decimal(7, 2)

  // Reference
  payPeriodId     String?   @map("pay_period_id")
  reference       String?
  notes           String?

  createdAt       DateTime  @default(now()) @map("created_at")
  createdBy       String?   @map("created_by")

  employee        Employee  @relation(fields: [employeeId], references: [id])
  leaveType       LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@index([employeeId, accrualDate])
  @@index([leaveTypeId])
  @@map("leave_accruals")
}

// Leave Policies (overrides at organization/pay group level)
model LeavePolicy {
  id              String    @id @default(uuid())
  organizationId  String    @map("organization_id")
  payGroupId      String?   @map("pay_group_id")
  leaveTypeId     String    @map("leave_type_id")

  // Entitlement Override
  entitlementDays Decimal?  @map("entitlement_days") @db.Decimal(5, 2)

  // Service-based Tiers
  serviceTiers    Json?     @map("service_tiers")
  // Example: [{ minYears: 5, entitlement: 20 }, { minYears: 10, entitlement: 25 }]

  // Employment Type Rules
  employmentTypeRules Json? @map("employment_type_rules")
  // Example: { PERMANENT: 15, CONTRACT: 10, CASUAL: 0 }

  effectiveFrom   DateTime  @map("effective_from") @db.Date
  effectiveTo     DateTime? @map("effective_to") @db.Date

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  leaveType       LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@index([organizationId, effectiveFrom])
  @@map("leave_policies")
}

// Public Holidays
model PublicHoliday {
  id              String    @id @default(uuid())
  country         Country
  year            Int
  date            DateTime  @db.Date
  name            String
  observedDate    DateTime? @map("observed_date") @db.Date
  isNational      Boolean   @default(true) @map("is_national")
  region          String?   // For regional holidays

  createdAt       DateTime  @default(now()) @map("created_at")

  @@unique([country, year, date])
  @@index([country, year])
  @@map("public_holidays")
}
```

---

## Service Layer

### Core Leave Service

```typescript
@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly countryPackRegistry: CountryPackRegistry,
    private readonly balanceService: LeaveBalanceService,
    private readonly accrualService: LeaveAccrualService,
    private readonly calendarService: LeaveCalendarService,
  ) {}

  async getLeaveBalance(
    employeeId: string,
    leaveTypeCode: string,
    asOfDate: Date = new Date(),
  ): Promise<LeaveBalanceDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { employments: true },
    });

    // Get country pack for employee's country
    const country = this.getEmployeeCountry(employee);
    const countryPack = this.countryPackRegistry.get(country);

    return this.balanceService.calculateBalance(
      employee,
      leaveTypeCode,
      asOfDate,
      countryPack,
    );
  }

  async submitLeaveRequest(
    employeeId: string,
    dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequestDto> {
    const employee = await this.getEmployee(employeeId);
    const country = this.getEmployeeCountry(employee);
    const countryPack = this.countryPackRegistry.get(country);

    // Calculate working days (excluding public holidays and weekends)
    const workingDays = await this.calendarService.calculateWorkingDays(
      dto.startDate,
      dto.endDate,
      country,
    );

    // Validate request against country rules
    const validation = countryPack.validateLeaveRequest({
      employee,
      leaveType: dto.leaveTypeCode,
      startDate: dto.startDate,
      endDate: dto.endDate,
      days: workingDays,
    });

    if (!validation.valid) {
      throw new BadRequestException(validation.errors);
    }

    // Check balance
    const balance = await this.getLeaveBalance(
      employeeId,
      dto.leaveTypeCode,
      dto.startDate,
    );

    if (balance.available < workingDays && !dto.allowNegative) {
      throw new BadRequestException('Insufficient leave balance');
    }

    // Create request
    return this.createRequest(employee, dto, workingDays);
  }
}
```

---

## Payroll Integration

### Leave Impact on Payroll

```typescript
@Injectable()
export class LeavePayrollService {
  async calculateLeaveDeductions(
    payrunId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<LeaveDeduction[]> {
    // Get all approved leave in the period
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: {
        employee: { include: { employments: true } },
        leaveType: true,
      },
    });

    const deductions: LeaveDeduction[] = [];

    for (const request of leaveRequests) {
      const country = this.getEmployeeCountry(request.employee);
      const countryPack = this.countryPackRegistry.get(country);

      // Calculate days in this pay period
      const daysInPeriod = this.calculateDaysInPeriod(
        request,
        periodStart,
        periodEnd,
      );

      // Get pay impact from country pack
      const payImpact = countryPack.calculatePayDeduction(
        request.employee,
        request.leaveType.code,
        daysInPeriod,
      );

      if (payImpact.amount > 0) {
        deductions.push({
          employeeId: request.employeeId,
          leaveRequestId: request.id,
          leaveType: request.leaveType.code,
          days: daysInPeriod,
          deductionAmount: payImpact.amount,
          paidAmount: payImpact.paidAmount,
          deductionType: payImpact.deductionType,
        });
      }
    }

    return deductions;
  }
}
```

---

## Adding New Countries

### Step-by-Step Guide

1. **Document Leave Entitlements**
   - Add to `docs/leave-management/LEAVE_ENTITLEMENTS.md`
   - Include all leave types, entitlements, and rules

2. **Create Country Pack**
   ```
   src/country-packs/{country_code}/
   ├── leave/
   │   ├── {cc}-leave.policy.ts
   │   ├── {cc}-leave.config.ts
   │   └── {cc}-public-holidays.ts
   ```

3. **Implement ICountryLeavePack Interface**
   ```typescript
   @Injectable()
   export class BWLeavePack implements ICountryLeavePack {
     readonly countryCode = Country.BW;
     // ... implement all methods
   }
   ```

4. **Register in Country Pack Module**
   ```typescript
   @Module({
     providers: [
       ZALeavePack,
       LSLeavePack,
       BWLeavePack,  // New country
     ],
   })
   export class CountryPacksModule {}
   ```

5. **Seed Default Leave Types**
   ```typescript
   async function seedBWLeaveTypes(prisma: PrismaService) {
     const leaveTypes = [
       { code: 'ANNUAL', name: 'Annual Leave', ... },
       { code: 'SICK', name: 'Sick Leave', ... },
     ];
     // ... seed logic
   }
   ```

6. **Seed Public Holidays**
   ```typescript
   async function seedBWPublicHolidays(prisma: PrismaService, year: number) {
     const holidays = [
       { date: new Date(year, 0, 1), name: "New Year's Day" },
       // ...
     ];
   }
   ```

---

## Benefits of This Architecture

| Benefit | Description |
|---------|-------------|
| **Extensibility** | Add new countries with minimal code changes |
| **Maintainability** | Country rules isolated in their own packs |
| **Testability** | Each country pack can be unit tested independently |
| **Flexibility** | Organization-level policy overrides supported |
| **Compliance** | Statutory requirements documented and enforced |
| **Auditability** | All leave transactions logged with full history |

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01 | System | Initial architecture for ZA and LS |
