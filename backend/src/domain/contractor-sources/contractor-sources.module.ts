import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { OracleHcmModule } from '../../integration/oracle-hcm/oracle-hcm.module';
import { OracleHcmSyncService } from '../../integration/oracle-hcm/oracle-hcm-sync.service';
import { SourceIntegrationModule } from '../../integration/source-integration.module';
import { SupplierSourcesModule } from '../supplier-sources/supplier-sources.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ContractorMigrationModule } from '../contractor-migration/contractor-migration.module';
import { ContractorGovernanceModule } from '../contractor-governance/contractor-governance.module';
import { DemoModule } from '../demo/demo.module';
import { ContractorSourceSyncRunService } from './contractor-source-sync-run.service';
import { ContractorCorrelationService } from './contractor-correlation.service';
import { HcmContractorConnectorStagingWriterService } from './hcm-contractor-connector-staging-writer.service';
import { OracleHcmImportController } from './oracle-hcm-import.controller';
import { HcmConnectorTelemetryService } from './hcm-connector-telemetry.service';
import { HcmConnectorOperationsDashboardService } from './hcm-connector-operations-dashboard.service';
import { ContractorSourceDriftDetectionService } from './contractor-source-drift-detection.service';
import { ContractorSourceDriftService } from './contractor-source-drift.service';
import { HcmWorkforceCutoverService } from './hcm-workforce-cutover.service';
import { HcmBootstrapDecayService } from './hcm-bootstrap-decay.service';
import { WorkforceAssessmentService } from './workforce-assessment.service';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    OracleHcmModule,
    ContractorMigrationModule,
    ContractorGovernanceModule,
    DemoModule,
    forwardRef(() => SourceIntegrationModule),
    forwardRef(() => SupplierSourcesModule),
    SuppliersModule,
  ],
  controllers: [OracleHcmImportController],
  providers: [
    ContractorSourceSyncRunService,
    ContractorCorrelationService,
    HcmContractorConnectorStagingWriterService,
    OracleHcmSyncService,
    HcmConnectorTelemetryService,
    HcmConnectorOperationsDashboardService,
    ContractorSourceDriftDetectionService,
    ContractorSourceDriftService,
    HcmWorkforceCutoverService,
    HcmBootstrapDecayService,
    WorkforceAssessmentService,
  ],
  exports: [
    ContractorSourceSyncRunService,
    ContractorCorrelationService,
    HcmContractorConnectorStagingWriterService,
    OracleHcmSyncService,
    HcmConnectorTelemetryService,
    HcmConnectorOperationsDashboardService,
    ContractorSourceDriftDetectionService,
    ContractorSourceDriftService,
    HcmWorkforceCutoverService,
    HcmBootstrapDecayService,
    WorkforceAssessmentService,
  ],
})
export class ContractorSourcesModule {}
