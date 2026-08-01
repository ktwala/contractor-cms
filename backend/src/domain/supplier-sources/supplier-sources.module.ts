import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { OracleProcurementModule } from '../../integration/oracle-procurement/oracle-procurement.module';
import { OracleProcurementSyncService } from '../../integration/oracle-procurement/oracle-procurement-sync.service';
import { OracleProcurementHealthService } from '../../integration/oracle-procurement/oracle-procurement-health.service';
import { SourceIntegrationModule } from '../../integration/source-integration.module';
import { OracleSupplierSourceAdapter } from './adapters/oracle-supplier-source.adapter';
import { OracleSupplierImportController } from './oracle-supplier-import.controller';
import { OracleSupplierImportService } from './oracle-supplier-import.service';
import { SupplierSourceReconciliationService } from './supplier-source-reconciliation.service';
import { SupplierGovernanceTwinPromotionService } from './supplier-governance-twin-promotion.service';
import { SupplierStagingWriterService } from './supplier-staging-writer.service';
import { SupplierSourceSyncRunService } from './supplier-source-sync-run.service';
import { SupplierStagingReadService } from './supplier-staging-read.service';
import { OracleConnectorTelemetryService } from './oracle-connector-telemetry.service';
import { OracleConnectorAnomaliesService } from './oracle-connector-anomalies.service';
import { OracleConnectorOperationsDashboardService } from './oracle-connector-operations-dashboard.service';
import { SupplierSourceDriftDetectionService } from './supplier-source-drift-detection.service';
import { SupplierSourceDriftService } from './supplier-source-drift.service';
import { SupplierSyncAssessmentService } from './supplier-sync-assessment.service';
import { HcmSupplierReferenceReconciliationService } from './hcm-supplier-reference-reconciliation.service';
import { DemoMtnStorySetupService } from '../demo/demo-mtn-story-setup.service';
import { DemoSupplierGovernanceSetupService } from '../demo/demo-supplier-governance-setup.service';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { DemoModule } from '../demo/demo.module';
import { ContractorMigrationModule } from '../contractor-migration/contractor-migration.module';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    OracleProcurementModule,
    DemoModule,
    ContractorMigrationModule,
    forwardRef(() => SourceIntegrationModule),
    forwardRef(() => SuppliersModule),
  ],
  controllers: [OracleSupplierImportController],
  providers: [
    OracleSupplierImportService,
    SupplierSourceReconciliationService,
    SupplierGovernanceTwinPromotionService,
    SupplierStagingWriterService,
    SupplierSourceSyncRunService,
    SupplierStagingReadService,
    OracleProcurementSyncService,
    OracleProcurementHealthService,
    OracleConnectorTelemetryService,
    OracleConnectorAnomaliesService,
    OracleConnectorOperationsDashboardService,
    SupplierSourceDriftDetectionService,
    SupplierSourceDriftService,
    SupplierSyncAssessmentService,
    HcmSupplierReferenceReconciliationService,
    DemoMtnStorySetupService,
    DemoSupplierGovernanceSetupService,
    OracleSupplierSourceAdapter,
  ],
  exports: [
    OracleSupplierImportService,
    SupplierSourceReconciliationService,
    SupplierGovernanceTwinPromotionService,
    SupplierStagingWriterService,
    SupplierSourceSyncRunService,
    SupplierStagingReadService,
    OracleProcurementSyncService,
    OracleProcurementHealthService,
    OracleConnectorTelemetryService,
    OracleConnectorAnomaliesService,
    OracleConnectorOperationsDashboardService,
    SupplierSourceDriftDetectionService,
    SupplierSourceDriftService,
    SupplierSyncAssessmentService,
    HcmSupplierReferenceReconciliationService,
    DemoMtnStorySetupService,
    DemoSupplierGovernanceSetupService,
    OracleSupplierSourceAdapter,
  ],
})
export class SupplierSourcesModule {}
