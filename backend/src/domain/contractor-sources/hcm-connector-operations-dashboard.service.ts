import { Injectable } from '@nestjs/common';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { OracleHcmHealthService } from '../../integration/oracle-hcm/oracle-hcm-health.service';
import { ContractorSourceSyncRunService } from './contractor-source-sync-run.service';
import { HcmConnectorTelemetryService } from './hcm-connector-telemetry.service';
import { ContractorSourceDriftService } from './contractor-source-drift.service';
import { ContractorGovernanceRemediationService } from '../contractor-governance/contractor-governance-remediation.service';
import { HcmConnectorOperationsDashboardDto } from './dto/hcm-connector-operations-dashboard.dto';
import { PrismaService } from '../../core/database/prisma.service';
import { WorkforceAssessmentService } from './workforce-assessment.service';
import { HcmSupplierReferenceReconciliationService } from '../supplier-sources/hcm-supplier-reference-reconciliation.service';
import {
  EMPTY_HCM_CORRELATION_TELEMETRY,
  EMPTY_HCM_GOVERNANCE_TELEMETRY,
  EMPTY_HCM_OPERATIONAL_WORKFORCE_TELEMETRY,
  emptyHcmDriftSummary,
  emptyHcmRemediationSummary,
  gateHcmOperationalRiskTelemetry,
  isWorkforceAssessmentTelemetryVisible,
} from './workforce-assessment-telemetry-gate.util';

/**
 * PR-CTR-CONNECTOR-1E — Workforce Governance Operations dashboard.
 */
@Injectable()
export class HcmConnectorOperationsDashboardService {
  constructor(
    private readonly healthService: OracleHcmHealthService,
    private readonly telemetryService: HcmConnectorTelemetryService,
    private readonly syncRunService: ContractorSourceSyncRunService,
    private readonly driftService: ContractorSourceDriftService,
    private readonly remediationService: ContractorGovernanceRemediationService,
    private readonly prisma: PrismaService,
    private readonly workforceAssessment: WorkforceAssessmentService,
    private readonly hcmSupplierReferenceReconciliation: HcmSupplierReferenceReconciliationService,
  ) {}

  async getDashboard(
    accessContext: AccessContext,
  ): Promise<HcmConnectorOperationsDashboardDto> {
    const orgId = accessContext.targetOrganizationId!;
    const workforceAssessment = await this.workforceAssessment.resolveStatus(orgId);
    const assessmentTelemetryVisible = isWorkforceAssessmentTelemetryVisible(
      workforceAssessment.lifecyclePhase,
    );

    if (workforceAssessment.latestDiscoveryRun) {
      try {
        await this.hcmSupplierReferenceReconciliation.syncObservations(orgId);
      } catch {
        // Non-blocking — reconciliation queue loads on next assessment if sync fails here.
      }
    }

    const [health, telemetry, recentRuns, driftSummaryRaw, remediationSummaryRaw, org, discoverySnapshotHistory] =
      await Promise.all([
        this.healthService.getHealthSnapshot(orgId),
        this.telemetryService.getTelemetry(accessContext),
        this.syncRunService.listRuns(accessContext, { page: 1, limit: 5 }),
        assessmentTelemetryVisible
          ? this.driftService.getSummary(accessContext)
          : Promise.resolve(emptyHcmDriftSummary(orgId)),
        assessmentTelemetryVisible
          ? this.remediationService.getSummary(accessContext)
          : Promise.resolve(emptyHcmRemediationSummary(orgId)),
        this.prisma.organization.findUnique({
          where: { id: orgId },
          select: { workforceMigrationCutoverAt: true },
        }),
        this.workforceAssessment.listSnapshotHistory(orgId, 20),
      ]);

    return {
      organizationId: orgId,
      connectorHealth: health,
      syncTelemetry: telemetry.connector,
      correlationTelemetry: assessmentTelemetryVisible
        ? telemetry.correlation
        : EMPTY_HCM_CORRELATION_TELEMETRY,
      governanceTelemetry: assessmentTelemetryVisible
        ? telemetry.governance
        : EMPTY_HCM_GOVERNANCE_TELEMETRY,
      operationalRiskTelemetry: gateHcmOperationalRiskTelemetry(
        telemetry.operationalRisk,
        workforceAssessment.lifecyclePhase,
      ),
      operationalWorkforceTelemetry: assessmentTelemetryVisible
        ? telemetry.operationalWorkforce
        : EMPTY_HCM_OPERATIONAL_WORKFORCE_TELEMETRY,
      driftSummary: driftSummaryRaw,
      remediationSummary: remediationSummaryRaw,
      recentSyncRuns: recentRuns.data,
      workforceMigrationCutoverAt: org?.workforceMigrationCutoverAt?.toISOString() ?? null,
      workforceAssessment,
      discoverySnapshotHistory,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
