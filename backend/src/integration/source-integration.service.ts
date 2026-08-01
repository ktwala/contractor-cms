import { BadRequestException, Injectable } from '@nestjs/common';
import { AccessContext } from '../core/auth/interfaces/access-context.interface';
import {
  NormalizedGovernanceTwinBatchResult,
  NormalizedGovernanceTwinPromotionResult,
  NormalizedSupplierImportRequest,
  NormalizedSupplierImportResult,
  NormalizedSupplierStagingListQuery,
  NormalizedSupplierStagingListResult,
} from './contracts/normalized-supplier-source.dto';
import { ContractorBootstrapOracleRestInput } from './contracts/contractor-source.adapter';
import type { IngestFileBatchDto } from '../domain/contractor-migration/dto/ingest-file-batch.dto';
import type { HcmExtractBatchSummary } from '../domain/contractor-migration/types/hcm-extract.types';
import { SourceAdapterRegistry } from './source-adapter.registry';
import { OracleProcurementSyncService } from './oracle-procurement/oracle-procurement-sync.service';
import { OracleProcurementHealthService } from './oracle-procurement/oracle-procurement-health.service';
import { OracleConnectorTelemetryService } from '../domain/supplier-sources/oracle-connector-telemetry.service';
import { OracleConnectorAnomaliesService } from '../domain/supplier-sources/oracle-connector-anomalies.service';
import { OracleConnectorOperationsDashboardService } from '../domain/supplier-sources/oracle-connector-operations-dashboard.service';
import { SupplierSourceSyncRunService } from '../domain/supplier-sources/supplier-source-sync-run.service';
import {
  SupplierSourceDriftSeverity,
  SupplierSourceDriftStatus,
  SupplierSourceDriftType,
  SupplierSourceSyncRunMode,
  SupplierSourceSyncRunStatus,
} from '@prisma/client';
import { SupplierSourceDriftService } from '../domain/supplier-sources/supplier-source-drift.service';
import { HcmSupplierReferenceReconciliationService } from '../domain/supplier-sources/hcm-supplier-reference-reconciliation.service';
import { OracleHcmSyncService } from './oracle-hcm/oracle-hcm-sync.service';
import { OracleHcmHealthService } from './oracle-hcm/oracle-hcm-health.service';
import { ContractorSourceSyncRunService } from '../domain/contractor-sources/contractor-source-sync-run.service';
import { HcmConnectorTelemetryService } from '../domain/contractor-sources/hcm-connector-telemetry.service';
import { HcmConnectorOperationsDashboardService } from '../domain/contractor-sources/hcm-connector-operations-dashboard.service';
import { ContractorSourceDriftService } from '../domain/contractor-sources/contractor-source-drift.service';
import {
  ContractorSourceDriftSeverity,
  ContractorSourceDriftStatus,
  ContractorSourceDriftType,
} from '@prisma/client';
import type { OracleHcmFileImportDto } from '../domain/contractor-sources/dto/oracle-hcm-import.dto';

/**
 * PR-CMS-INT-3 — controller-facing facade; routes to tenant-enabled source adapters.
 */
@Injectable()
export class SourceIntegrationService {
  constructor(
    private readonly registry: SourceAdapterRegistry,
    private readonly oracleSync: OracleProcurementSyncService,
    private readonly oracleHealth: OracleProcurementHealthService,
    private readonly oracleTelemetry: OracleConnectorTelemetryService,
    private readonly oracleAnomalies: OracleConnectorAnomaliesService,
    private readonly oracleOpsDashboard: OracleConnectorOperationsDashboardService,
    private readonly syncRunService: SupplierSourceSyncRunService,
    private readonly driftService: SupplierSourceDriftService,
    private readonly hcmSupplierReferenceReconciliation: HcmSupplierReferenceReconciliationService,
    private readonly hcmSync: OracleHcmSyncService,
    private readonly hcmHealth: OracleHcmHealthService,
    private readonly contractorSyncRunService: ContractorSourceSyncRunService,
    private readonly hcmTelemetry: HcmConnectorTelemetryService,
    private readonly hcmOpsDashboard: HcmConnectorOperationsDashboardService,
    private readonly contractorDriftService: ContractorSourceDriftService,
  ) {}

  importSuppliers(
    accessContext: AccessContext,
    request: NormalizedSupplierImportRequest,
  ): Promise<NormalizedSupplierImportResult> {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then((adapter) => adapter.importSuppliers(accessContext, request));
  }

  syncOracleSuppliersIncremental(accessContext: AccessContext) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.oracleSync.syncIncremental(accessContext));
  }

  getOracleConnectorHealth(accessContext: AccessContext) {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.oracleHealth.getHealthSnapshot(orgId));
  }

  getOracleConnectorTelemetry(accessContext: AccessContext) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.oracleTelemetry.getTelemetry(accessContext));
  }

  getOracleConnectorDashboard(accessContext: AccessContext) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.oracleOpsDashboard.getDashboard(accessContext));
  }

  listOracleSyncRuns(
    accessContext: AccessContext,
    query: {
      status?: SupplierSourceSyncRunStatus;
      mode?: SupplierSourceSyncRunMode;
      page?: number;
      limit?: number;
    },
  ) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.syncRunService.listRuns(accessContext, query));
  }

  getOracleConnectorAnomalies(accessContext: AccessContext) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.oracleAnomalies.getAnomalies(accessContext));
  }

  listOracleSourceDrift(
    accessContext: AccessContext,
    query: {
      status?: SupplierSourceDriftStatus;
      severity?: SupplierSourceDriftSeverity;
      driftType?: SupplierSourceDriftType;
      page?: number;
      limit?: number;
    },
  ) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.driftService.listDrifts(accessContext, query));
  }

  getOracleSourceDriftSummary(accessContext: AccessContext) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.driftService.getSummary(accessContext));
  }

  detectOracleSourceDrift(accessContext: AccessContext) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.driftService.runDetection(accessContext));
  }

  listSupplierReconciliationWorkItems(accessContext: AccessContext) {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.hcmSupplierReferenceReconciliation.listWorkItems(orgId));
  }

  getOracleSourceDrift(accessContext: AccessContext, driftId: string) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.driftService.getDrift(accessContext, driftId));
  }

  assignOracleSourceDrift(
    accessContext: AccessContext,
    driftId: string,
    assignedToUserId: string,
  ) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.driftService.assignDrift(accessContext, driftId, assignedToUserId));
  }

  resolveOracleSourceDrift(
    accessContext: AccessContext,
    driftId: string,
    resolutionNotes: string,
  ) {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then(() => this.driftService.resolveDrift(accessContext, driftId, resolutionNotes));
  }

  listSupplierStaging(
    accessContext: AccessContext,
    query: NormalizedSupplierStagingListQuery,
  ): Promise<NormalizedSupplierStagingListResult> {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then((adapter) => adapter.listStaging(accessContext, query));
  }

  promoteSupplierStagingRow(
    accessContext: AccessContext,
    stagingId: string,
  ): Promise<NormalizedGovernanceTwinPromotionResult> {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then((adapter) => adapter.promoteStagingRow(accessContext, stagingId));
  }

  promoteSupplierStagingBatch(
    accessContext: AccessContext,
    stagingIds?: string[],
  ): Promise<NormalizedGovernanceTwinBatchResult> {
    return this.registry
      .requireSupplierAdapter(accessContext)
      .then((adapter) => adapter.promoteStagingBatch(accessContext, stagingIds));
  }

  bootstrapContractorsFromFile(
    accessContext: AccessContext,
    organizationId: string,
    dto: IngestFileBatchDto,
  ): Promise<HcmExtractBatchSummary> {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then((adapter) => adapter.bootstrapIngestFile(organizationId, dto));
  }

  bootstrapContractorsFromOracleRest(
    accessContext: AccessContext,
    organizationId: string,
    input: ContractorBootstrapOracleRestInput,
  ): Promise<HcmExtractBatchSummary> {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then((adapter) => adapter.bootstrapIngestOracleRest(organizationId, input));
  }

  getOracleHcmConnectorHealth(accessContext: AccessContext) {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.hcmHealth.getHealthSnapshot(orgId));
  }

  syncOracleHcmContractorsIncremental(accessContext: AccessContext) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.hcmSync.syncIncremental(accessContext));
  }

  importOracleHcmContractorsFromFile(
    accessContext: AccessContext,
    dto: OracleHcmFileImportDto,
  ) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.hcmSync.importFromFile(accessContext, dto));
  }

  listOracleHcmSyncRuns(
    accessContext: AccessContext,
    query: { page?: number; limit?: number },
  ) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.contractorSyncRunService.listRuns(accessContext, query));
  }

  getOracleHcmConnectorTelemetry(accessContext: AccessContext) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.hcmTelemetry.getTelemetry(accessContext));
  }

  getOracleHcmConnectorDashboard(accessContext: AccessContext) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.hcmOpsDashboard.getDashboard(accessContext));
  }

  listOracleHcmSourceDrift(
    accessContext: AccessContext,
    query: {
      status?: ContractorSourceDriftStatus;
      severity?: ContractorSourceDriftSeverity;
      driftType?: ContractorSourceDriftType;
      operationalOnly?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.contractorDriftService.listDrifts(accessContext, query));
  }

  getOracleHcmSourceDriftSummary(accessContext: AccessContext) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.contractorDriftService.getSummary(accessContext));
  }

  detectOracleHcmSourceDrift(accessContext: AccessContext) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.contractorDriftService.runDetection(accessContext));
  }

  getOracleHcmSourceDrift(accessContext: AccessContext, driftId: string) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() => this.contractorDriftService.getDrift(accessContext, driftId));
  }

  assignOracleHcmSourceDrift(
    accessContext: AccessContext,
    driftId: string,
    assignedToUserId: string,
  ) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() =>
        this.contractorDriftService.assignDrift(
          accessContext,
          driftId,
          assignedToUserId,
        ),
      );
  }

  resolveOracleHcmSourceDrift(
    accessContext: AccessContext,
    driftId: string,
    resolutionNotes: string,
  ) {
    return this.registry
      .requireContractorBootstrapAdapter(accessContext)
      .then(() =>
        this.contractorDriftService.resolveDrift(
          accessContext,
          driftId,
          resolutionNotes,
        ),
      );
  }
}
