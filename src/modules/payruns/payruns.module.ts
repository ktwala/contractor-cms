import { Module, forwardRef } from '@nestjs/common';
import { PayrunsController } from './payruns.controller';
import { PayrunsService } from './payruns.service';
import { PayrunLifecycleService } from './payrun-lifecycle.service';
import { PayrunCalculationService } from './payrun-calculation.service';
import { PayrunSnapshotService } from './payrun-snapshot.service';
import { PayrunEngineService } from './payrun-engine.service';
import { FormulaEvaluationService } from './formula-evaluation.service';
import { PayrunExceptionService } from './exceptions/payrun-exception.service';
import { PayrunExceptionController, PayrunExceptionWorkflowController } from './exceptions/payrun-exception.controller';
import { PayrunReconciliationService } from './payrun-reconciliation.service';
import { EmployeesModule } from '../employees/employees.module';
import { PayItemsModule } from '../pay-items/pay-items.module';
import { TaxModule } from '../tax/tax.module';
import { RulesModule } from '../rules/rules.module';
import { JobsModule } from '../jobs/jobs.module';
import { CountryPacksModule } from '../../country-packs/country-packs.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../../core/audit/audit.module';
import { PayrollReadinessModule } from '../payroll-readiness/payroll-readiness.module';
import { PayrunReadinessGateService } from './payrun-readiness-gate.service';
import { PayrunFinancialControlService } from './payrun-financial-control.service';
import { PayrunBankReconciliationService } from './payrun-bank-reconciliation.service';
import { PayrunGLReconciliationService } from './payrun-gl-reconciliation.service';
import { PayrunClosedPeriodMutationGuardService } from './payrun-closed-period-mutation-guard.service';
import { PayrunReversalWorkflowService } from './payrun-reversal-workflow.service';
import { PayrunCorrectionApprovalService } from './payrun-correction-approval.service';
import { PayrunPostCloseReconciliationImpactService } from './payrun-post-close-reconciliation-impact.service';
import { PayrunGovernanceHealthService } from './payrun-governance-health.service';
import { PayrunGovernancePolicyResolutionService } from './payrun-governance-policy-resolution.service';

@Module({
  imports: [
    AuditModule,
    PayrollReadinessModule,
    EmployeesModule,
    PayItemsModule,
    TaxModule,
    RulesModule,
    forwardRef(() => JobsModule),
    forwardRef(() => CountryPacksModule),
    forwardRef(() => ApprovalsModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [PayrunsController, PayrunExceptionController, PayrunExceptionWorkflowController],
  providers: [
    PayrunsService,
    PayrunLifecycleService,
    PayrunCalculationService,
    PayrunSnapshotService,
    PayrunEngineService,
    FormulaEvaluationService,
    PayrunExceptionService,
    PayrunReconciliationService,
    PayrunReadinessGateService,
    PayrunFinancialControlService,
    PayrunBankReconciliationService,
    PayrunGLReconciliationService,
    PayrunReversalWorkflowService,
    PayrunCorrectionApprovalService,
    PayrunClosedPeriodMutationGuardService,
    PayrunPostCloseReconciliationImpactService,
    PayrunGovernanceHealthService,
    PayrunGovernancePolicyResolutionService,
  ],
  exports: [
    PayrunsService,
    PayrunLifecycleService,
    PayrunCalculationService,
    PayrunEngineService,
    FormulaEvaluationService,
    PayrunExceptionService,
    PayrunReadinessGateService,
    PayrunFinancialControlService,
    PayrunBankReconciliationService,
    PayrunGLReconciliationService,
    PayrunReversalWorkflowService,
    PayrunCorrectionApprovalService,
    PayrunClosedPeriodMutationGuardService,
    PayrunPostCloseReconciliationImpactService,
    PayrunGovernanceHealthService,
    PayrunGovernancePolicyResolutionService,
  ],
})
export class PayrunsModule {}
