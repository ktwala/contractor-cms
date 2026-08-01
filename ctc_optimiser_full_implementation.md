# CTC Optimiser — Full Implementation Pack

## 1. Scope

This implementation adds a **CTC Optimiser** feature to the Hubsec Workforce Platform so authorised users can generate, compare, explain, approve, and apply compensation structures using the **same payroll computation pipeline** used for real payroll calculations.

The design assumes the existing platform patterns already in use:
- NestJS backend
- Prisma ORM
- React frontend
- pack-based tax routing via `PackRouterService`
- payroll computation via existing payrun snapshot / simulation services
- multi-tenant RBAC and audit logging
- approval / SoD-friendly governance patterns

This pack is structured so engineering can implement it incrementally without creating a second tax engine.

---

## 2. Core implementation principles

1. **No duplicate tax logic**
   Every scenario must be evaluated through the real payroll compute flow.

2. **Country-pack aware**
   The optimiser must resolve routing through the same pack and statutory configuration path as normal payroll calculations.

3. **Deterministic and auditable**
   Every optimisation run must store inputs, resolved routing, assumptions, generated scenarios, warnings, scores, and selected outcome.

4. **Policy-constrained**
   The optimiser should not propose package structures that violate employer policy or country-specific rules.

5. **Explainable**
   Each recommendation must tell the user why it ranks where it does.

---

## 3. Functional flows

### 3.1 Run optimisation

1. User opens CTC Optimiser.
2. User enters CTC, goals, benefits, constraints, and employee context.
3. Backend validates input and resolves effective routing.
4. Scenario generator creates candidate package structures.
5. Constraint service filters or annotates invalid / risky structures.
6. Valid scenarios are evaluated through the payroll compute engine.
7. Ranker scores results.
8. Explanation service attaches reasoning and warnings.
9. Top scenarios are returned to the UI.
10. Run and scenarios are persisted.

### 3.2 View optimisation run

1. User opens a prior optimisation run.
2. Backend returns input, ranking, selected scenario, warnings, assumptions, routing metadata, and audit info.

### 3.3 Apply scenario

1. User selects one ranked scenario.
2. If policy requires approval, the scenario enters approval workflow.
3. If direct apply is allowed, the structure is saved to the target employee compensation draft / package profile.
4. Audit events are recorded.

---

## 4. Suggested backend module layout

```text
backend/src/payroll/ctc-optimiser/
  ctc-optimiser.controller.ts
  ctc-optimiser.module.ts
  ctc-optimiser.service.ts
  dto/
    run-ctc-optimiser.dto.ts
    apply-ctc-scenario.dto.ts
    ctc-optimiser-response.dto.ts
  domain/
    ctc-optimiser.types.ts
    ctc-optimiser.constants.ts
  services/
    ctc-scenario-generator.service.ts
    ctc-constraint.service.ts
    ctc-scenario-evaluator.service.ts
    ctc-scenario-ranker.service.ts
    ctc-explanation.service.ts
    ctc-policy.service.ts
  mappers/
    ctc-optimiser.mapper.ts
  tests/
    ctc-optimiser.service.spec.ts
    ctc-scenario-generator.service.spec.ts
    ctc-constraint.service.spec.ts
    ctc-scenario-ranker.service.spec.ts
    ctc-optimiser.integration.spec.ts
```

---

## 5. Prisma data model

```prisma
model CtcOptimiserRun {
  id                     String   @id @default(uuid())
  tenantId               String
  legalEntityId          String?
  employeeId             String?
  countryCode            String
  taxYear                String
  payFrequency           String
  optimisationMode       String
  inputJson              Json
  routingJson            Json?
  assumptionsJson        Json?
  status                 String   @default("COMPLETED")
  selectedScenarioId     String?
  createdByUserId        String
  approvedByUserId       String?
  appliedByUserId        String?
  createdAt              DateTime @default(now())
  approvedAt             DateTime?
  appliedAt              DateTime?

  scenarios              CtcOptimiserScenario[]
  decisions              CtcOptimiserDecision[]

  @@index([tenantId, createdAt])
  @@index([employeeId, createdAt])
  @@index([legalEntityId, createdAt])
}

model CtcOptimiserScenario {
  id                     String   @id @default(uuid())
  runId                  String
  scenarioCode           String
  rank                   Int?
  isValid                Boolean  @default(true)
  policyStatus           String   @default("PASS")
  inputBreakdownJson     Json
  payrollOutputJson      Json
  explanationsJson       Json?
  warningsJson           Json?
  scoreTotal             Float?
  scoreBreakdownJson     Json?
  checksum               String?
  createdAt              DateTime @default(now())

  run                    CtcOptimiserRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId, rank])
}

model CtcOptimiserDecision {
  id                     String   @id @default(uuid())
  runId                  String
  scenarioId             String
  decisionType           String
  decisionStatus         String   @default("PENDING")
  decidedByUserId        String?
  notes                  String?
  createdAt              DateTime @default(now())
  decidedAt              DateTime?

  run                    CtcOptimiserRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId, createdAt])
}
```

### Suggested enums

Use app-level enums or Prisma enums later if already consistent with your platform:
- `optimisationMode`: `MAX_NET`, `TARGET_NET`, `BALANCED`
- `status`: `COMPLETED`, `PENDING_APPROVAL`, `APPROVED`, `APPLIED`, `FAILED`
- `policyStatus`: `PASS`, `WARN`, `BLOCK`
- `decisionType`: `SELECT`, `APPROVE`, `REJECT`, `APPLY`
- `decisionStatus`: `PENDING`, `APPROVED`, `REJECTED`, `APPLIED`

---

## 6. DTOs and types

### 6.1 Request DTO

```ts
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MedicalAidInputDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNumber()
  @Min(0)
  beneficiaries!: number;
}

class RetirementInputDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number;
}

class TravelInputDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPercent?: number;
}

class ReimbursiveInputDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number;
}

class OptimiserConstraintDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBasicPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAllowancePercent?: number;

  @IsOptional()
  @IsBoolean()
  requireMedicalAidAsEmployerContribution?: boolean;

  @IsOptional()
  @IsBoolean()
  requireRetirementFund?: boolean;
}

export class RunCtcOptimiserDto {
  @IsString()
  countryCode!: string;

  @IsString()
  taxYear!: string;

  @IsString()
  payFrequency!: string;

  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsNumber()
  @Min(1)
  ctc!: number;

  @IsString()
  optimisationMode!: 'MAX_NET' | 'TARGET_NET' | 'BALANCED';

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetNet?: number;

  @ValidateNested()
  @Type(() => MedicalAidInputDto)
  medicalAid!: MedicalAidInputDto;

  @ValidateNested()
  @Type(() => RetirementInputDto)
  retirement!: RetirementInputDto;

  @ValidateNested()
  @Type(() => TravelInputDto)
  travel!: TravelInputDto;

  @ValidateNested()
  @Type(() => ReimbursiveInputDto)
  reimbursive!: ReimbursiveInputDto;

  @ValidateNested()
  @Type(() => OptimiserConstraintDto)
  constraints!: OptimiserConstraintDto;

  @IsOptional()
  @IsObject()
  employeeContext?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  scenarioTags?: string[];
}
```

### 6.2 Domain types

```ts
export type CtcOptimisationMode = 'MAX_NET' | 'TARGET_NET' | 'BALANCED';

export interface CtcScenarioBreakdown {
  basicSalary: number;
  travelAllowance: number;
  reimbursiveTravelNonTaxable: number;
  otherAllowanceTaxable: number;
  otherAllowanceNonTaxable: number;
  medicalAidEmployerContribution: number;
  retirementContribution: number;
}

export interface CtcScenarioScoreBreakdown {
  netFitScore: number;
  complianceScore: number;
  policyScore: number;
  sustainabilityScore: number;
  simplicityScore: number;
  totalScore: number;
}

export interface CtcScenarioEvaluation {
  taxableIncome: number;
  paye: number;
  uif: number;
  netPay: number;
  grossEarnings: number;
  deductions: number;
  employerCost: number;
  creditsApplied?: Record<string, number>;
  engineOutput: Record<string, unknown>;
}
```

---

## 7. Controller implementation

```ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CtcOptimiserService } from './ctc-optimiser.service';
import { RunCtcOptimiserDto } from './dto/run-ctc-optimiser.dto';
import { ApplyCtcScenarioDto } from './dto/apply-ctc-scenario.dto';
import { CapabilityGuard } from '../../auth/guards/capability.guard';
import { RequireCapabilities } from '../../auth/decorators/require-capabilities.decorator';

@Controller('/api/v1/payroll/ctc-optimiser')
@UseGuards(CapabilityGuard)
export class CtcOptimiserController {
  constructor(private readonly ctcOptimiserService: CtcOptimiserService) {}

  @Post('/run')
  @RequireCapabilities('payroll.ctc_optimiser.run')
  async run(@Body() dto: RunCtcOptimiserDto) {
    return this.ctcOptimiserService.runOptimisation(dto);
  }

  @Get('/run/:id')
  @RequireCapabilities('payroll.ctc_optimiser.view')
  async getRun(@Param('id') id: string) {
    return this.ctcOptimiserService.getRun(id);
  }

  @Post('/apply')
  @RequireCapabilities('payroll.ctc_optimiser.apply')
  async apply(@Body() dto: ApplyCtcScenarioDto) {
    return this.ctcOptimiserService.applyScenario(dto);
  }
}
```

---

## 8. Service orchestration

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PackRouterService } from '../country-packs/services/pack-router.service';
import { CtcScenarioGeneratorService } from './services/ctc-scenario-generator.service';
import { CtcConstraintService } from './services/ctc-constraint.service';
import { CtcScenarioEvaluatorService } from './services/ctc-scenario-evaluator.service';
import { CtcScenarioRankerService } from './services/ctc-scenario-ranker.service';
import { CtcExplanationService } from './services/ctc-explanation.service';
import { RunCtcOptimiserDto } from './dto/run-ctc-optimiser.dto';

@Injectable()
export class CtcOptimiserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packRouterService: PackRouterService,
    private readonly generator: CtcScenarioGeneratorService,
    private readonly constraintService: CtcConstraintService,
    private readonly evaluator: CtcScenarioEvaluatorService,
    private readonly ranker: CtcScenarioRankerService,
    private readonly explanationService: CtcExplanationService,
  ) {}

  async runOptimisation(input: RunCtcOptimiserDto) {
    const routing = await this.packRouterService.resolveRouting({
      country: input.countryCode,
      legal_entity_id: input.legalEntityId,
      pay_date: new Date().toISOString(),
      period_end: new Date().toISOString(),
    });

    const run = await this.prisma.ctcOptimiserRun.create({
      data: {
        tenantId: 'resolve-from-context',
        legalEntityId: input.legalEntityId,
        employeeId: input.employeeId,
        countryCode: input.countryCode,
        taxYear: input.taxYear,
        payFrequency: input.payFrequency,
        optimisationMode: input.optimisationMode,
        inputJson: input,
        routingJson: routing,
        assumptionsJson: {
          generatedAt: new Date().toISOString(),
          routingVersion: (routing as any)?.pack_version ?? null,
        },
        createdByUserId: 'resolve-from-auth-context',
      },
    });

    const rawScenarios = this.generator.generate(input);

    const evaluated = [];
    for (const scenario of rawScenarios) {
      const policy = this.constraintService.validate(input, scenario);
      if (policy.status === 'BLOCK') {
        evaluated.push({
          scenario,
          policy,
          evaluation: null,
          explanations: this.explanationService.explainBlockedScenario(policy),
          warnings: policy.warnings,
          score: null,
        });
        continue;
      }

      const evaluation = await this.evaluator.evaluate({ input, scenario, routing });
      const explanations = this.explanationService.explainScenario({ input, scenario, evaluation, policy });
      evaluated.push({ scenario, policy, evaluation, explanations, warnings: policy.warnings });
    }

    const ranked = this.ranker.rank(input, evaluated);

    for (let i = 0; i < ranked.length; i += 1) {
      const item = ranked[i];
      await this.prisma.ctcOptimiserScenario.create({
        data: {
          runId: run.id,
          scenarioCode: `SCN-${String(i + 1).padStart(3, '0')}`,
          rank: item.rank,
          isValid: item.policy.status !== 'BLOCK',
          policyStatus: item.policy.status,
          inputBreakdownJson: item.scenario,
          payrollOutputJson: item.evaluation ?? {},
          explanationsJson: item.explanations,
          warningsJson: item.warnings,
          scoreTotal: item.score?.totalScore ?? null,
          scoreBreakdownJson: item.score ?? null,
          checksum: item.checksum,
        },
      });
    }

    return this.getRun(run.id);
  }

  async getRun(id: string) {
    return this.prisma.ctcOptimiserRun.findUnique({
      where: { id },
      include: {
        scenarios: {
          orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
        },
        decisions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async applyScenario(dto: { runId: string; scenarioId: string; notes?: string }) {
    const scenario = await this.prisma.ctcOptimiserScenario.findUnique({
      where: { id: dto.scenarioId },
      include: { run: true },
    });

    if (!scenario) {
      throw new Error('Scenario not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ctcOptimiserDecision.create({
        data: {
          runId: scenario.runId,
          scenarioId: scenario.id,
          decisionType: 'APPLY',
          decisionStatus: 'APPLIED',
          decidedByUserId: 'resolve-from-auth-context',
          notes: dto.notes,
          decidedAt: new Date(),
        },
      });

      await tx.ctcOptimiserRun.update({
        where: { id: scenario.runId },
        data: {
          selectedScenarioId: scenario.id,
          status: 'APPLIED',
          appliedByUserId: 'resolve-from-auth-context',
          appliedAt: new Date(),
        },
      });

      // TODO: map breakdown to employee compensation draft / package profile
      // TODO: write platform audit event
    });

    return { success: true };
  }
}
```

---

## 9. Scenario generator

The first version should be **heuristic and bounded**, not a combinatorial brute-force engine.

### Generator strategy

1. Determine required fixed items:
   - medical aid
   - minimum retirement
   - mandated benefits

2. Determine adjustable bands:
   - basic salary
   - travel allowance
   - reimbursive travel
   - taxable and non-taxable other allowances

3. Generate 10–25 candidate combinations.

4. Filter impossible scenarios early:
   - total exceeds CTC
   - basic below configured minimum
   - allowance share above ceiling

### Example implementation

```ts
import { Injectable } from '@nestjs/common';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';

@Injectable()
export class CtcScenarioGeneratorService {
  generate(input: RunCtcOptimiserDto) {
    const ctc = input.ctc;
    const medical = input.medicalAid.amount;
    const retirementMin = input.retirement.minAmount ?? 0;
    const retirementTarget = input.retirement.targetAmount ?? retirementMin;

    const minBasicPercent = input.constraints.minBasicPercent ?? 55;
    const maxTravelPercent = input.travel.enabled ? input.travel.maxPercent ?? 25 : 0;
    const reimbursiveMax = input.reimbursive.enabled ? input.reimbursive.maxAmount ?? Math.min(ctc * 0.05, 5000) : 0;

    const basicPercents = [minBasicPercent, 60, 65, 70, 75].filter((p) => p <= 85);
    const travelPercents = input.travel.enabled ? [10, 15, 20, maxTravelPercent].filter((p) => p > 0) : [0];
    const retirementCandidates = Array.from(new Set([retirementMin, retirementTarget, Math.max(retirementTarget, ctc * 0.1)])).filter((v) => v >= 0);

    const scenarios: Array<Record<string, number>> = [];

    for (const basicPercent of basicPercents) {
      for (const travelPercent of travelPercents) {
        for (const retirement of retirementCandidates) {
          const reimbursive = reimbursiveMax;
          const basicSalary = Math.round((ctc * basicPercent) / 100);
          const travelAllowance = Math.round((ctc * travelPercent) / 100);
          const fixedUsed = medical + retirement + reimbursive + basicSalary + travelAllowance;
          const otherAllowanceNonTaxable = 0;
          const otherAllowanceTaxable = Math.max(0, Math.round(ctc - fixedUsed - otherAllowanceNonTaxable));

          if (basicSalary + travelAllowance + reimbursive + medical + retirement + otherAllowanceTaxable > ctc) {
            continue;
          }

          scenarios.push({
            basicSalary,
            travelAllowance,
            reimbursiveTravelNonTaxable: reimbursive,
            otherAllowanceTaxable,
            otherAllowanceNonTaxable,
            medicalAidEmployerContribution: medical,
            retirementContribution: retirement,
          });
        }
      }
    }

    const deduped = new Map<string, Record<string, number>>();
    for (const scenario of scenarios) {
      deduped.set(JSON.stringify(scenario), scenario);
    }

    return Array.from(deduped.values()).slice(0, 25);
  }
}
```

---

## 10. Constraint service

This service should produce:
- `PASS`
- `WARN`
- `BLOCK`

### Checks to enforce

- basic salary minimum
- max allowance share
- travel not enabled when role/policy disallows it
- reimbursive amount only when enabled
- mandatory retirement when policy requires it
- mandatory employer medical structure when policy requires it
- country-pack support for requested optimisation inputs

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CtcConstraintService {
  validate(input: any, scenario: any) {
    const warnings: string[] = [];
    const blocks: string[] = [];

    const totalAllowanceShare =
      scenario.travelAllowance +
      scenario.reimbursiveTravelNonTaxable +
      scenario.otherAllowanceTaxable +
      scenario.otherAllowanceNonTaxable;

    const basicPercent = (scenario.basicSalary / input.ctc) * 100;
    const allowancePercent = (totalAllowanceShare / input.ctc) * 100;

    if (input.constraints.minBasicPercent && basicPercent < input.constraints.minBasicPercent) {
      blocks.push(`Basic salary is below minimum policy threshold of ${input.constraints.minBasicPercent}%`);
    }

    if (
      input.constraints.maxAllowancePercent &&
      allowancePercent > input.constraints.maxAllowancePercent
    ) {
      blocks.push(`Allowance share exceeds maximum policy threshold of ${input.constraints.maxAllowancePercent}%`);
    }

    if (!input.travel.enabled && scenario.travelAllowance > 0) {
      blocks.push('Travel allowance is not permitted for this optimisation input');
    }

    if (!input.reimbursive.enabled && scenario.reimbursiveTravelNonTaxable > 0) {
      blocks.push('Reimbursive travel is not permitted for this optimisation input');
    }

    if (
      input.constraints.requireRetirementFund &&
      (!scenario.retirementContribution || scenario.retirementContribution <= 0)
    ) {
      blocks.push('Retirement contribution is required by policy');
    }

    if (
      input.constraints.requireMedicalAidAsEmployerContribution &&
      scenario.medicalAidEmployerContribution !== input.medicalAid.amount
    ) {
      blocks.push('Medical aid must be structured as employer contribution');
    }

    if (scenario.travelAllowance > 0) {
      warnings.push('Travel allowance requires valid business justification and logbook support.');
    }

    if (scenario.reimbursiveTravelNonTaxable > 0) {
      warnings.push('Reimbursive travel must align to approved claim and reimbursement rules.');
    }

    if ((scenario.retirementContribution / input.ctc) * 100 < 7.5) {
      warnings.push('Retirement contribution is relatively low for long-term sustainability.');
    }

    if (blocks.length > 0) {
      return { status: 'BLOCK', warnings: [...warnings, ...blocks], blocks };
    }

    if (warnings.length > 0) {
      return { status: 'WARN', warnings, blocks: [] };
    }

    return { status: 'PASS', warnings: [], blocks: [] };
  }
}
```

---

## 11. Scenario evaluator

This is where alignment with the real payroll engine matters.

### Mapping rule

Each scenario should be transformed into the same earnings / deductions shape your payroll pipeline already accepts.

Example mapping:
- `basicSalary` → earning code `BASIC_SALARY`
- `travelAllowance` → earning code `TRAVEL_ALLOWANCE`
- `reimbursiveTravelNonTaxable` → earning code `REIMB_TRAVEL_NON_TAXABLE`
- `otherAllowanceTaxable` → earning code `OTHER_ALLOWANCE_TAXABLE`
- `medicalAidEmployerContribution` → earning code `MEDICAL_AID_FRINGE`
- `retirementContribution` → deduction code `RETIREMENT_FUND`
- medical aid deduction side if your model requires explicit deduction entry

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CtcScenarioEvaluatorService {
  constructor(
    // inject your real payroll calculation bridge service here
    private readonly payrollSimulationBridge: any,
  ) {}

  async evaluate({ input, scenario, routing }: { input: any; scenario: any; routing: any }) {
    const payrollInput = {
      country: input.countryCode,
      legalEntityId: input.legalEntityId,
      employeeId: input.employeeId,
      payDate: new Date().toISOString(),
      periodEnd: new Date().toISOString(),
      earnings: [
        { code: 'BASIC_SALARY', amount: scenario.basicSalary },
        { code: 'TRAVEL_ALLOWANCE', amount: scenario.travelAllowance },
        { code: 'REIMB_TRAVEL_NON_TAXABLE', amount: scenario.reimbursiveTravelNonTaxable },
        { code: 'OTHER_ALLOWANCE_TAXABLE', amount: scenario.otherAllowanceTaxable },
        { code: 'OTHER_ALLOWANCE_NON_TAXABLE', amount: scenario.otherAllowanceNonTaxable },
        { code: 'MEDICAL_AID_FRINGE', amount: scenario.medicalAidEmployerContribution },
      ].filter((x) => x.amount > 0),
      deductions: [
        { code: 'RETIREMENT_FUND', amount: scenario.retirementContribution },
        { code: 'MEDICAL_AID_CONTRIBUTION', amount: scenario.medicalAidEmployerContribution },
      ].filter((x) => x.amount > 0),
      routing,
    };

    const result = await this.payrollSimulationBridge.simulate(payrollInput);

    return {
      taxableIncome: result.taxableIncome,
      paye: result.paye,
      uif: result.uif,
      netPay: result.netPay,
      grossEarnings: result.grossEarnings,
      deductions: result.totalDeductions,
      employerCost: result.employerCost,
      creditsApplied: result.taxCredits ?? {},
      engineOutput: result,
    };
  }
}
```

### Important integration note

If your current platform does not yet expose a clean simulation bridge, create a thin internal adapter instead of duplicating logic.

Suggested bridge:
- `PayrollSimulationBridgeService.simulate(input)`

That bridge can internally call existing snapshot or simulation flows and normalise the output for the optimiser.

---

## 12. Ranking logic

```ts
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class CtcScenarioRankerService {
  rank(input: any, items: any[]) {
    const ranked = items.map((item) => {
      if (!item.evaluation) {
        return {
          ...item,
          rank: null,
          score: {
            netFitScore: 0,
            complianceScore: 0,
            policyScore: 0,
            sustainabilityScore: 0,
            simplicityScore: 0,
            totalScore: 0,
          },
          checksum: this.checksum(item),
        };
      }

      const netFitScore = this.netFitScore(input, item.evaluation.netPay);
      const complianceScore = item.policy.status === 'PASS' ? 100 : 75;
      const policyScore = item.policy.status === 'PASS' ? 100 : 80;
      const retirementRatio = item.scenario.retirementContribution / input.ctc;
      const sustainabilityScore = Math.min(100, Math.round(retirementRatio * 1000));
      const nonZeroFields = Object.values(item.scenario).filter((v: any) => Number(v) > 0).length;
      const simplicityScore = Math.max(50, 100 - (nonZeroFields - 2) * 10);

      const totalScore =
        netFitScore * 0.4 +
        complianceScore * 0.2 +
        policyScore * 0.2 +
        sustainabilityScore * 0.1 +
        simplicityScore * 0.1;

      return {
        ...item,
        score: {
          netFitScore,
          complianceScore,
          policyScore,
          sustainabilityScore,
          simplicityScore,
          totalScore: Number(totalScore.toFixed(2)),
        },
        checksum: this.checksum(item),
      };
    });

    return ranked
      .sort((a, b) => (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  private netFitScore(input: any, netPay: number) {
    if (input.optimisationMode === 'MAX_NET') {
      return Math.min(100, Math.round((netPay / input.ctc) * 120));
    }

    if (input.targetNet && input.targetNet > 0) {
      const diff = Math.abs(input.targetNet - netPay);
      const variancePercent = diff / input.targetNet;
      return Math.max(0, Math.round(100 - variancePercent * 250));
    }

    return 80;
  }

  private checksum(item: any) {
    return createHash('sha256').update(JSON.stringify(item)).digest('hex');
  }
}
```

---

## 13. Explanation service

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CtcExplanationService {
  explainScenario({ input, scenario, evaluation, policy }: any): string[] {
    const items: string[] = [];

    items.push(`Estimated net pay is ${evaluation.netPay.toFixed(2)} based on the current payroll compute engine.`);

    if (scenario.travelAllowance > 0) {
      items.push('Net pay improves partly because a portion of the package is structured through travel allowance.');
    }

    if (scenario.medicalAidEmployerContribution > 0) {
      items.push('Medical aid is included as employer-funded structure and should benefit from tax-credit treatment where configured by the country pack.');
    }

    if (scenario.retirementContribution > 0) {
      items.push('Retirement contribution reduces immediate taxable income but also trades some take-home cash for long-term savings.');
    }

    if (policy.status === 'WARN') {
      items.push('This scenario is usable but includes policy or compliance warnings that should be reviewed before applying.');
    }

    if (input.optimisationMode === 'TARGET_NET' && input.targetNet) {
      const delta = evaluation.netPay - input.targetNet;
      if (Math.abs(delta) <= 1000) {
        items.push('This option lands very close to the requested target net pay.');
      } else if (delta > 0) {
        items.push('This option exceeds the requested target net pay.');
      } else {
        items.push('This option falls below the requested target net pay.');
      }
    }

    return items;
  }

  explainBlockedScenario(policy: any): string[] {
    return ['This scenario was blocked by policy or configuration constraints.', ...(policy.blocks ?? [])];
  }
}
```

---

## 14. Capability registry and RBAC

### Capabilities

Add to your payroll capability registry:

```ts
export const PAYROLL_CTC_OPTIMISER_CAPABILITIES = [
  'payroll.ctc_optimiser.run',
  'payroll.ctc_optimiser.view',
  'payroll.ctc_optimiser.apply',
  'payroll.ctc_optimiser.approve',
] as const;
```

### Recommended role mapping

- Payroll Admin: run, view, apply, approve
- HR Manager: run, view
- Finance Reviewer: view
- Compensation Approver: view, approve

### SoD rules

If approval is enabled:
- the same user who ran the optimisation should not be the final approver for applying a package if that matches your platform governance style
- applying a scenario after approval should emit an explicit audit trail

---

## 15. Audit events

Add structured events such as:
- `CTC_OPTIMISER_RUN`
- `CTC_OPTIMISER_SCENARIO_BLOCKED`
- `CTC_OPTIMISER_SCENARIO_SELECTED`
- `CTC_OPTIMISER_APPROVED`
- `CTC_OPTIMISER_APPLIED`
- `CTC_OPTIMISER_OVERRIDE_ACKNOWLEDGED`

Payload should include:
- tenantId
- employeeId
- legalEntityId
- runId
- scenarioId
- optimisationMode
- countryCode
- packVersion
- warningsAcknowledged
- actorUserId

---

## 16. Frontend module layout

```text
frontend/src/pages/payroll/ctc-optimiser/
  CtcOptimiserPage.tsx
frontend/src/components/payroll/ctc-optimiser/
  CtcOptimiserForm.tsx
  CtcOptimiserGoalCard.tsx
  CtcOptimiserScenarioCard.tsx
  CtcOptimiserScenarioCompareTable.tsx
  CtcOptimiserWarningsPanel.tsx
  CtcOptimiserExplanationList.tsx
  CtcOptimiserApplyDialog.tsx
frontend/src/services/
  ctcOptimiserService.ts
  ctcOptimiser.types.ts
frontend/src/hooks/
  useCtcOptimiser.ts
  useCtcOptimiserRun.ts
frontend/src/lib/permissions/
  ctcOptimiser.ts
```

---

## 17. Frontend types and service

```ts
export interface RunCtcOptimiserRequest {
  countryCode: string;
  taxYear: string;
  payFrequency: string;
  legalEntityId?: string;
  employeeId?: string;
  ctc: number;
  optimisationMode: 'MAX_NET' | 'TARGET_NET' | 'BALANCED';
  targetNet?: number;
  medicalAid: { amount: number; beneficiaries: number };
  retirement: { minAmount?: number; targetAmount?: number };
  travel: { enabled: boolean; maxPercent?: number };
  reimbursive: { enabled: boolean; maxAmount?: number };
  constraints: {
    minBasicPercent?: number;
    maxAllowancePercent?: number;
    requireMedicalAidAsEmployerContribution?: boolean;
    requireRetirementFund?: boolean;
  };
}

export const ctcOptimiserService = {
  async run(payload: RunCtcOptimiserRequest) {
    const response = await apiClient.post('/api/v1/payroll/ctc-optimiser/run', payload);
    return response.data;
  },
  async getRun(runId: string) {
    const response = await apiClient.get(`/api/v1/payroll/ctc-optimiser/run/${runId}`);
    return response.data;
  },
  async apply(payload: { runId: string; scenarioId: string; notes?: string }) {
    const response = await apiClient.post('/api/v1/payroll/ctc-optimiser/apply', payload);
    return response.data;
  },
};
```

---

## 18. Frontend hooks

```ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { ctcOptimiserService } from '@/services/ctcOptimiserService';

export function useRunCtcOptimiser() {
  return useMutation({
    mutationFn: ctcOptimiserService.run,
  });
}

export function useCtcOptimiserRun(runId?: string) {
  return useQuery({
    queryKey: ['ctc-optimiser-run', runId],
    queryFn: () => ctcOptimiserService.getRun(runId!),
    enabled: Boolean(runId),
  });
}

export function useApplyCtcScenario() {
  return useMutation({
    mutationFn: ctcOptimiserService.apply,
  });
}
```

---

## 19. Frontend page implementation

```tsx
import { useMemo, useState } from 'react';
import { useRunCtcOptimiser, useApplyCtcScenario } from '@/hooks/useCtcOptimiser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CtcOptimiserForm } from '@/components/payroll/ctc-optimiser/CtcOptimiserForm';
import { CtcOptimiserScenarioCard } from '@/components/payroll/ctc-optimiser/CtcOptimiserScenarioCard';

export default function CtcOptimiserPage() {
  const [result, setResult] = useState<any>(null);
  const runMutation = useRunCtcOptimiser();
  const applyMutation = useApplyCtcScenario();

  const scenarios = useMemo(() => result?.scenarios ?? result?.scenarios ?? result?.scenarios, [result]);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>CTC Optimiser</CardTitle>
        </CardHeader>
        <CardContent>
          <CtcOptimiserForm
            isSubmitting={runMutation.isPending}
            onSubmit={async (values) => {
              const data = await runMutation.mutateAsync(values);
              setResult(data);
            }}
          />
        </CardContent>
      </Card>

      {result?.scenarios?.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {result.scenarios.map((scenario: any) => (
            <CtcOptimiserScenarioCard
              key={scenario.id}
              scenario={scenario}
              onApply={async () => {
                await applyMutation.mutateAsync({
                  runId: result.id,
                  scenarioId: scenario.id,
                });
              }}
              applyDisabled={applyMutation.isPending}
            />
          ))}
        </div>
      )}

      {result?.scenarios?.length === 0 && result && (
        <Card>
          <CardContent className="pt-6">
            No valid scenarios were returned. Review your constraints and try again.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## 20. Example form component

```tsx
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CtcOptimiserForm({ onSubmit, isSubmitting }: any) {
  const form = useForm({
    defaultValues: {
      countryCode: 'ZA',
      taxYear: '2025/2026',
      payFrequency: 'monthly',
      ctc: 120000,
      optimisationMode: 'TARGET_NET',
      targetNet: 80000,
      medicalAid: { amount: 15000, beneficiaries: 2 },
      retirement: { minAmount: 5000, targetAmount: 10000 },
      travel: { enabled: true, maxPercent: 25 },
      reimbursive: { enabled: true, maxAmount: 5000 },
      constraints: {
        minBasicPercent: 55,
        maxAllowancePercent: 35,
        requireMedicalAidAsEmployerContribution: true,
        requireRetirementFund: true,
      },
    },
  });

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label>Total CTC</Label>
        <Input type="number" {...form.register('ctc', { valueAsNumber: true })} />
      </div>

      <div className="space-y-2">
        <Label>Target Net</Label>
        <Input type="number" {...form.register('targetNet', { valueAsNumber: true })} />
      </div>

      <div className="space-y-2">
        <Label>Medical Aid</Label>
        <Input type="number" {...form.register('medicalAid.amount', { valueAsNumber: true })} />
      </div>

      <div className="space-y-2">
        <Label>Retirement Target</Label>
        <Input type="number" {...form.register('retirement.targetAmount', { valueAsNumber: true })} />
      </div>

      <div className="space-y-2">
        <Label>Max Travel %</Label>
        <Input type="number" {...form.register('travel.maxPercent', { valueAsNumber: true })} />
      </div>

      <div className="space-y-2">
        <Label>Max Reimbursive</Label>
        <Input type="number" {...form.register('reimbursive.maxAmount', { valueAsNumber: true })} />
      </div>

      <div className="md:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Running…' : 'Run optimisation'}
        </Button>
      </div>
    </form>
  );
}
```

---

## 21. Example scenario card

```tsx
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function CtcOptimiserScenarioCard({ scenario, onApply, applyDisabled }: any) {
  const breakdown = scenario.inputBreakdownJson ?? {};
  const payroll = scenario.payrollOutputJson ?? {};
  const explanations = scenario.explanationsJson ?? [];
  const warnings = scenario.warningsJson ?? [];

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>
          {scenario.rank ? `Option ${scenario.rank}` : 'Blocked option'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>Net Pay: <strong>{payroll.netPay ?? '-'}</strong></div>
        <div>PAYE: <strong>{payroll.paye ?? '-'}</strong></div>
        <div>Basic: {breakdown.basicSalary ?? 0}</div>
        <div>Travel: {breakdown.travelAllowance ?? 0}</div>
        <div>Medical: {breakdown.medicalAidEmployerContribution ?? 0}</div>
        <div>Retirement: {breakdown.retirementContribution ?? 0}</div>

        {explanations.length > 0 && (
          <div>
            <div className="font-medium">Why this option</div>
            <ul className="list-disc pl-5">
              {explanations.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div>
            <div className="font-medium">Warnings</div>
            <ul className="list-disc pl-5 text-amber-700">
              {warnings.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={onApply} disabled={applyDisabled || scenario.policyStatus === 'BLOCK'}>
          Apply scenario
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

## 22. Navigation and route registration

### Frontend route

Add route:
- `/payroll/ctc-optimiser`

### Suggested sidebar placement

Under Payroll planning or compensation:
- Payroll
  - Payruns
  - Reconciliation
  - Reports
  - Compensation Planning
    - CTC Optimiser

### Route capability

```ts
{
  key: 'payroll_ctc_optimiser',
  label: 'CTC Optimiser',
  path: '/payroll/ctc-optimiser',
  capability: 'payroll.ctc_optimiser.view',
}
```

---

## 23. Approval and apply workflow

For v1, support direct apply if user has `payroll.ctc_optimiser.apply`.

For v2, add approval workflow:
- run generated by payroll admin or HR
- selected scenario moves to `PENDING_APPROVAL`
- approver with `payroll.ctc_optimiser.approve` approves
- separate actor applies

This matches your existing governance style well.

---

## 24. API response shape

```json
{
  "id": "run-id",
  "countryCode": "ZA",
  "optimisationMode": "TARGET_NET",
  "selectedScenarioId": null,
  "scenarios": [
    {
      "id": "scenario-id-1",
      "rank": 1,
      "policyStatus": "PASS",
      "inputBreakdownJson": {
        "basicSalary": 75000,
        "travelAllowance": 25000,
        "reimbursiveTravelNonTaxable": 5000,
        "otherAllowanceTaxable": 0,
        "otherAllowanceNonTaxable": 0,
        "medicalAidEmployerContribution": 15000,
        "retirementContribution": 10000
      },
      "payrollOutputJson": {
        "taxableIncome": 85000,
        "paye": 28000,
        "uif": 177.12,
        "netPay": 81200,
        "grossEarnings": 120000,
        "deductions": 25000,
        "employerCost": 120000
      },
      "scoreTotal": 92.4,
      "scoreBreakdownJson": {
        "netFitScore": 96,
        "complianceScore": 100,
        "policyScore": 100,
        "sustainabilityScore": 83,
        "simplicityScore": 90,
        "totalScore": 92.4
      },
      "explanationsJson": [
        "Estimated net pay is 81200.00 based on the current payroll compute engine.",
        "Medical aid is included as employer-funded structure and should benefit from tax-credit treatment where configured by the country pack."
      ],
      "warningsJson": [
        "Travel allowance requires valid business justification and logbook support."
      ]
    }
  ]
}
```

---

## 25. Example backend integration bridge contract

If you want a clean abstraction layer, add:

```ts
export interface PayrollSimulationBridgeInput {
  country: string;
  legalEntityId?: string;
  employeeId?: string;
  payDate: string;
  periodEnd: string;
  earnings: Array<{ code: string; amount: number }>;
  deductions: Array<{ code: string; amount: number }>;
  routing: Record<string, unknown>;
}

export interface PayrollSimulationBridgeOutput {
  taxableIncome: number;
  paye: number;
  uif: number;
  netPay: number;
  grossEarnings: number;
  totalDeductions: number;
  employerCost: number;
  taxCredits?: Record<string, number>;
  details?: Record<string, unknown>;
}
```

This keeps the optimiser isolated from the details of your current compute service.

---

## 26. Test plan

### Unit tests

1. `CtcScenarioGeneratorService`
- generates only valid total-package scenarios
- respects travel toggle
- respects reimbursive toggle
- includes retirement target candidates

2. `CtcConstraintService`
- blocks below minimum basic percent
- blocks above allowance threshold
- warns on travel
- warns on low retirement

3. `CtcScenarioRankerService`
- ranks higher net fit above weaker net fit in target mode
- blocked scenarios score zero
- checksum is stable

4. `CtcExplanationService`
- includes travel explanation when travel allowance > 0
- includes target-net explanation when relevant

### Integration tests

1. run optimisation returns ranked scenarios
2. stored run persists scenarios and scores
3. apply updates run status to `APPLIED`
4. capability denial prevents unauthorised access
5. country-pack routing metadata is persisted

### Example test cases

- ZA monthly, CTC 120000, target net 80000, medical aid 15000, retirement 10000, travel enabled
- ZA monthly, CTC 60000, no travel, low constraints
- scenario blocked because `minBasicPercent = 70` but scenario basic = 55
- scenario blocked because reimbursive requested while disabled

---

## 27. Seed data and demo preset

To demo the feature, add preset templates:

- `Executive balanced`
- `Cash maximiser`
- `Retirement focused`
- `Medical-heavy family package`

Each preset should prefill form values, not bypass engine rules.

Example preset JSON:

```json
{
  "name": "Executive balanced",
  "countryCode": "ZA",
  "taxYear": "2025/2026",
  "payFrequency": "monthly",
  "ctc": 120000,
  "optimisationMode": "TARGET_NET",
  "targetNet": 80000,
  "medicalAid": { "amount": 15000, "beneficiaries": 2 },
  "retirement": { "minAmount": 5000, "targetAmount": 10000 },
  "travel": { "enabled": true, "maxPercent": 25 },
  "reimbursive": { "enabled": true, "maxAmount": 5000 },
  "constraints": {
    "minBasicPercent": 55,
    "maxAllowancePercent": 35,
    "requireMedicalAidAsEmployerContribution": true,
    "requireRetirementFund": true
  }
}
```

---

## 28. Rollout plan

### Phase 1 — MVP
- backend run/view/apply
- heuristic scenario generation
- ZA monthly only
- RBAC and audit events
- frontend form and ranked cards

### Phase 2 — governance hardening
- approval workflow
- scenario compare grid
- warning acknowledgement
- export to package summary / offer model

### Phase 3 — advanced optimisation
- smarter search / guided optimisation
- policy packs by employer
- cross-country support
- package benchmarking

---

## 29. Implementation notes specific to your platform

1. Reuse the same routing resolution used by payrun snapshots.
2. Persist routing metadata so the optimiser result is reproducible.
3. Use your existing structured error-state pattern for blocked / missing setup states.
4. Add telemetry similar to your page-state events:
   - `ctc_optimiser_run_started`
   - `ctc_optimiser_run_completed`
   - `ctc_optimiser_run_failed`
   - `ctc_optimiser_scenario_applied`
5. If a legal entity or country-pack setup is missing, return a structured blocked response rather than a generic 500.

Example blocked codes:
- `PAYROLL_LEGAL_ENTITY_REQUIRED`
- `PAYROLL_CTC_OPTIMISER_COUNTRY_PACK_NOT_FOUND`
- `PAYROLL_CTC_OPTIMISER_TAX_TABLES_MISSING`
- `PAYROLL_CTC_OPTIMISER_POLICY_BLOCKED`

---

## 30. Delivery checklist

### Backend
- [ ] Prisma migration for optimiser tables
- [ ] module, controller, service scaffolding
- [ ] generator, constraint, evaluator, ranker, explanation services
- [ ] simulation bridge integration
- [ ] audit events
- [ ] capability registry update
- [ ] unit and integration tests

### Frontend
- [ ] route registration
- [ ] permissions helper
- [ ] form component
- [ ] scenario card component
- [ ] results page
- [ ] apply flow
- [ ] blocked / empty / loading page states
- [ ] telemetry

### Governance
- [ ] approval design decision
- [ ] SoD rule decision
- [ ] documentation update
- [ ] release note / admin guide note

---

## 31. Recommended next build order

1. Prisma schema + migration
2. backend controller and service scaffold
3. simulation bridge adapter
4. generator + constraint service
5. ranker + explanation service
6. integration test with one ZA happy path
7. frontend form
8. scenario cards
9. apply flow
10. approval hardening

---

## 32. Final implementation guidance

The strongest version of this feature is not the one that produces the most aggressive package structures. It is the one that users trust because:
- results match live payroll
- policy boundaries are enforced
- warnings are explicit
- explanations are clear
- every decision is auditable

That is what makes the CTC Optimiser credible as an enterprise payroll feature rather than just a salary calculator.

