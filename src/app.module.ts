import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';

// Core
import { DatabaseModule } from './core/database/database.module';
import { AuditModule } from './core/audit/audit.module';
import { PayslipTemplateModule } from './core/payslip/payslip-template.module';
import configuration from './core/config/configuration';

// Common
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { BootstrapModule } from './modules/bootstrap/bootstrap.module';
import { LegalEntitiesModule } from './modules/legal-entities/legal-entities.module';
import { PayGroupsModule } from './modules/pay-groups/pay-groups.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { HrModule } from './modules/hr/hr.module';
import { PayItemsModule } from './modules/pay-items/pay-items.module';
import { RulesModule } from './modules/rules/rules.module';
import { TaxModule } from './modules/tax/tax.module';
import { PayrunsModule } from './modules/payruns/payruns.module';
import { ChangeRequestsModule } from './modules/change-requests/change-requests.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ImportsModule } from './modules/imports/imports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SelfServiceModule } from './modules/self-service/self-service.module';
import { ExportsModule } from './modules/exports/exports.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { LeaveModule } from './modules/leave/leave.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { BenefitsModule } from './modules/benefits/benefits.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { LoansModule } from './modules/loans/loans.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { SarsModule } from './modules/sars/sars.module';
import { TimeAttendanceModule } from './modules/time-attendance/time-attendance.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { DataImportsModule } from './modules/data-imports/data-imports.module';
import { BootstrapPackModule } from './modules/bootstrap-pack/bootstrap-pack.module';
import { BootstrapImportModule } from './modules/bootstrap-import/bootstrap-import.module';
import { PayrollCycleModule } from './modules/payroll-cycle/payroll-cycle.module';
import { PayrollComplianceModule } from './modules/payroll-compliance/payroll-compliance.module';
import { RunCenterModule } from './modules/run-center/run-center.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { SetupModule } from './modules/setup/setup.module';
import { HierarchyModule } from './modules/hierarchy/hierarchy.module';
import { ApprovalRoutingModule } from './modules/approval-routing/approval-routing.module';
import { WorkforceIssuesModule } from './modules/workforce-issues/workforce-issues.module';
import { WorkforceReadinessModule } from './modules/workforce-readiness/workforce-readiness.module';
import { WorkforceStatsModule } from './modules/workforce-stats/workforce-stats.module';
import { OrgUnitManagerInferenceModule } from './modules/org-unit-manager-inference/org-unit-manager-inference.module';
import { WorkforceRemediationModule } from './modules/workforce-remediation/workforce-remediation.module';
import { WorkforceRemediationGovernanceModule } from './modules/workforce-remediation-governance/workforce-remediation-governance.module';
import { HierarchyIntelligenceModule } from './modules/hierarchy-intelligence/hierarchy-intelligence.module';
import { PayrollReadinessModule } from './modules/payroll-readiness/payroll-readiness.module';
import { PayrollResultsModule } from './modules/payroll-results/payroll-results.module';
import { PayrollStatutoryModule } from './modules/payroll-statutory/payroll-statutory.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { TaxTableAuthoringModule } from './modules/tax-table-authoring/tax-table-authoring.module';
import { TaxTableImpactAnalysisModule } from './modules/tax-table-impact-analysis/tax-table-impact-analysis.module';

// CTC Optimiser (compensation planning)
import { CtcOptimiserModule } from './modules/ctc-optimiser/ctc-optimiser.module';

// Country Packs
import { CountryPacksModule } from './country-packs/country-packs.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { PayrollContainersModule } from './modules/payroll-containers/payroll-containers.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),

    // Core
    DatabaseModule,
    AuditModule,
    PayslipTemplateModule,
    CommonModule,

    // Feature Modules
    AuthModule,
    BootstrapModule,
    LegalEntitiesModule,
    PayGroupsModule,
    PayrollContainersModule,
    EmployeesModule,
    HrModule,
    PayItemsModule,
    RulesModule,
    TaxModule,
    PayrunsModule,
    ChangeRequestsModule,
    JobsModule,
    ArtifactsModule,
    ReportsModule,
    ApprovalsModule,
    ImportsModule,
    DashboardModule,
    NotificationsModule,
    SelfServiceModule,
    ExportsModule,
    ComplianceModule,
    IntegrationsModule,
    LeaveModule,
    DocumentsModule,
    BenefitsModule,
    ExpensesModule,
    LoansModule,
    PerformanceModule,
    SarsModule,
    TimeAttendanceModule,
    MobileModule,
    EnterpriseModule,
    DataImportsModule,
    BootstrapPackModule,
    BootstrapImportModule,
    HierarchyModule,
    ApprovalRoutingModule,
    PayrollCycleModule,
    PayrollComplianceModule,
    RunCenterModule,
    RecruitmentModule,
    SetupModule,

    // Workforce Statistics & Readiness
    WorkforceIssuesModule,
    WorkforceReadinessModule,
    WorkforceStatsModule,
    OrgUnitManagerInferenceModule,
    WorkforceRemediationModule,
    WorkforceRemediationGovernanceModule,
    HierarchyIntelligenceModule,

    // Payroll Readiness
    PayrollReadinessModule,
    // Payroll Results Normalization
    PayrollResultsModule,
    // Statutory Returns
    PayrollStatutoryModule,

    // Payments
    PaymentsModule,

    // Admin
    AdminModule,

    // Tax Table Authoring (upstream governance for PackRouterService)
    TaxTableAuthoringModule,

    // Tax Table Impact Analysis (employee-level pre-publish comparison)
    TaxTableImpactAnalysisModule,

    // CTC Optimiser (compensation planning)
    CtcOptimiserModule,

    // Country Packs
    CountryPacksModule,

    PayrollModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule { }
