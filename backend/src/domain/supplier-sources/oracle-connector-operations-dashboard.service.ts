import { Injectable, Logger } from '@nestjs/common';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { OracleProcurementHealthService } from '../../integration/oracle-procurement/oracle-procurement-health.service';
import { SupplierGovernanceDashboardService } from '../suppliers/supplier-governance-dashboard.service';
import { OracleConnectorAnomaliesService } from './oracle-connector-anomalies.service';
import { OracleConnectorTelemetryService } from './oracle-connector-telemetry.service';
import { SupplierSourceSyncRunService } from './supplier-source-sync-run.service';
import { SupplierSourceDriftService } from './supplier-source-drift.service';
import { OracleConnectorOperationsDashboardDto } from './dto/oracle-connector-operations-dashboard.dto';
import { SupplierSyncAssessmentService } from './supplier-sync-assessment.service';
import { DemoSupplierGovernanceSetupService } from '../demo/demo-supplier-governance-setup.service';
import {
  EMPTY_ORACLE_DRIFT_TELEMETRY,
  EMPTY_ORACLE_GOVERNANCE_TELEMETRY,
  EMPTY_SUPPLIER_GOVERNANCE_BUCKETS,
  emptySupplierDriftSummary,
  isSupplierAssessmentTelemetryVisible,
} from './supplier-sync-assessment-telemetry-gate.util';

/**
 * PR-CMS-CONNECTOR-1G — unified ops dashboard; summarizes truth, never invents health.
 */
@Injectable()
export class OracleConnectorOperationsDashboardService {
  private readonly logger = new Logger(OracleConnectorOperationsDashboardService.name);

  constructor(
    private readonly healthService: OracleProcurementHealthService,
    private readonly telemetryService: OracleConnectorTelemetryService,
    private readonly anomaliesService: OracleConnectorAnomaliesService,
    private readonly governanceDashboard: SupplierGovernanceDashboardService,
    private readonly syncRunService: SupplierSourceSyncRunService,
    private readonly driftService: SupplierSourceDriftService,
    private readonly syncAssessment: SupplierSyncAssessmentService,
    private readonly demoSupplierGovernanceSetup: DemoSupplierGovernanceSetupService,
  ) {}

  async getDashboard(
    accessContext: AccessContext,
  ): Promise<OracleConnectorOperationsDashboardDto> {
    const orgId = accessContext.targetOrganizationId!;
    const supplierSyncAssessment = await this.syncAssessment.resolveStatus(orgId);
    const assessmentTelemetryVisible = isSupplierAssessmentTelemetryVisible(
      supplierSyncAssessment.lifecyclePhase,
    );

    if (assessmentTelemetryVisible) {
      try {
        await this.demoSupplierGovernanceSetup.materializeGovernanceDemoIfNeeded(
          accessContext,
        );
      } catch (err) {
        this.logger.warn(
          `Supplier governance demo materialization skipped: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const [health, telemetry, governance, anomalies, recentRuns, driftSummary, supplierDiscoverySnapshotHistory] =
      await Promise.all([
        this.healthService.getHealthSnapshot(orgId),
        this.telemetryService.getTelemetry(accessContext),
        assessmentTelemetryVisible
          ? this.governanceDashboard.getDashboard(accessContext)
          : Promise.resolve({
              organizationId: orgId,
              buckets: EMPTY_SUPPLIER_GOVERNANCE_BUCKETS,
              oracleLinkedTotal: 0,
            }),
        this.anomaliesService.getAnomalies(accessContext),
        this.syncRunService.listRuns(accessContext, { page: 1, limit: 5 }),
        assessmentTelemetryVisible
          ? this.driftService.getSummary(accessContext)
          : Promise.resolve(emptySupplierDriftSummary(orgId)),
        this.syncAssessment.listSnapshotHistory(orgId, 20),
      ]);

    return {
      organizationId: orgId,
      connectorHealth: health,
      syncTelemetry: telemetry.connector,
      governanceTelemetry: assessmentTelemetryVisible
        ? telemetry.governance
        : EMPTY_ORACLE_GOVERNANCE_TELEMETRY,
      governanceBuckets: governance.buckets,
      oracleLinkedTotal: assessmentTelemetryVisible ? governance.oracleLinkedTotal : 0,
      anomalies,
      driftSummary,
      recentSyncRuns: recentRuns.data,
      supplierSyncAssessment,
      supplierDiscoverySnapshotHistory,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
