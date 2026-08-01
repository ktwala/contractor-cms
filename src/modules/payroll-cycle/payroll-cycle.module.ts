import { Module, forwardRef } from '@nestjs/common';
import { PayrollCycleController } from './payroll-cycle.controller';
import { PayrollCalendarService } from './services/payroll-calendar.service';
import { PayrollChecklistService } from './services/payroll-checklist.service';
import { PayrollExceptionsService } from './services/payroll-exceptions.service';
import { PayrollReconciliationService } from './services/payroll-reconciliation.service';
import { PayrollForecastingService } from './services/payroll-forecasting.service';
import { PayrollPeriodCloseGateService } from './services/payroll-period-close-gate.service';
import { PayrollGovernancePortfolioService } from './services/payroll-governance-portfolio.service';
import { PayrollGovernancePortfolioEvidenceExportService } from './services/payroll-governance-portfolio-evidence-export.service';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { PayrunsModule } from '../payruns/payruns.module';
import { PayrollGovernancePolicyService } from './services/payroll-governance-policy.service';

@Module({
  imports: [DatabaseModule, AuditModule, forwardRef(() => PayrunsModule)],
  controllers: [PayrollCycleController],
  providers: [
    PayrollCalendarService,
    PayrollChecklistService,
    PayrollExceptionsService,
    PayrollReconciliationService,
    PayrollForecastingService,
    PayrollPeriodCloseGateService,
    PayrollGovernancePortfolioService,
    PayrollGovernancePortfolioEvidenceExportService,
    PayrollGovernancePolicyService,
  ],
  exports: [
    PayrollCalendarService,
    PayrollChecklistService,
    PayrollExceptionsService,
    PayrollReconciliationService,
    PayrollForecastingService,
    PayrollPeriodCloseGateService,
    PayrollGovernancePortfolioService,
    PayrollGovernancePortfolioEvidenceExportService,
    PayrollGovernancePolicyService,
  ],
})
export class PayrollCycleModule { }
