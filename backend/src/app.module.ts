import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './core/auth/auth.module';
import { HealthController } from './core/health/health.controller';
import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './core/common/filters/http-exception.filter';
import { validateEnvironment } from './core/config/env.validation';
import appConfig from './core/config/app.config';
import databaseConfig from './core/config/database.config';
import jwtConfig from './core/config/jwt.config';
import { AuditModule } from './core/audit/audit.module';
import { UsersModule } from './domain/users/users.module';
import { RolesModule } from './domain/roles/roles.module';
import { SuppliersModule } from './domain/suppliers/suppliers.module';
import { SupplierSourcesModule } from './domain/supplier-sources/supplier-sources.module';
import { SupplierPortalModule } from './domain/supplier-portal/supplier-portal.module';
import { ContractorsModule } from './domain/contractors/contractors.module';
import { ContractsModule } from './domain/contracts/contracts.module';
import { EngagementsModule } from './domain/engagements/engagements.module';
import { TimesheetsModule } from './domain/timesheets/timesheets.module';
import { InvoicesModule } from './domain/invoices/invoices.module';
import { TaxClassificationModule } from './domain/tax-classification/tax-classification.module';
import { ProjectsModule } from './domain/projects/projects.module';
import { WithholdingModule } from './domain/withholding/withholding.module';
import { OrganizationsModule } from './domain/organizations/organizations.module';
import { AnalyticsModule } from './domain/analytics/analytics.module';
import { PdpModule } from './pdp/pdp.module';
import { HcmModule } from './core/hcm/hcm.module';
import { IgaModule } from './core/iga/iga.module';
import { ExtidModule } from './core/extid/extid.module';
import { ResponsibleManagerTasksModule } from './domain/responsible-manager-tasks/responsible-manager-tasks.module';
import { ContractorMigrationModule } from './domain/contractor-migration/contractor-migration.module';
import { ContractorSourcesModule } from './domain/contractor-sources/contractor-sources.module';
import { ContractorGovernanceModule } from './domain/contractor-governance/contractor-governance.module';

@Module({
  imports: [
    // Configuration with validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env'],
      load: [appConfig, databaseConfig, jwtConfig],
      validate: validateEnvironment,
    }),

    // Database
    DatabaseModule,

    // HCM bridge (sponsor reference validation — disabled by default)
    HcmModule,

    // IGA event contract (outbound payload shape only — no bus / connector)
    IgaModule,

    // EXTID integration pull API (IGA consumes; no connector in CMS)
    ExtidModule,

    // Core
    AuditModule,

    // Authentication
    AuthModule,

    // Administration
    UsersModule,
    RolesModule,

    // Domain modules
    SuppliersModule,
    SupplierSourcesModule,
    SupplierPortalModule,
    ContractorsModule,
    ContractsModule,
    EngagementsModule,
    ResponsibleManagerTasksModule,
    ContractorMigrationModule,
    ContractorSourcesModule,
    ContractorGovernanceModule,
    TimesheetsModule,
    InvoicesModule,
    TaxClassificationModule,
    ProjectsModule,
    WithholdingModule,
    OrganizationsModule,
    AnalyticsModule,
    PdpModule,

    // Health checks
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global JWT guard (protects all routes by default)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
