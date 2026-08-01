import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HcmContractorCorrelationConfidence,
  HcmContractorCorrelationMatchStatus,
  HcmMigrationPipelineStatus,
  HcmStagingRecordAction,
  HcmStagingValidationStatus,
  MigrationSourceSystem,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import type { HcmExtractRecord } from '../contractor-migration/types/hcm-extract.types';
import { computeHcmSourceHash } from '../contractor-migration/utils/source-hash.util';
import { HcmContractorNormalizationService } from '../contractor-migration/services/hcm-contractor-normalization.service';
import {
  ContractorCorrelationOutcome,
  ContractorCorrelationService,
} from './contractor-correlation.service';
import { extractDemoWorkerScenarioFromPayload } from '../demo/demo-mtn-story.constants';

export type HcmConnectorStagingSummary = {
  imported: number;
  matched: number;
  possibleMatch: number;
  new: number;
  conflict: number;
  correlationFailures: number;
  failed: number;
};

export type HcmConnectorStagingWriteResult = {
  summary: HcmConnectorStagingSummary;
  stagingIds: string[];
};

/**
 * PR-CTR-CONNECTOR-1C — org-scoped replay-safe HCM staging upsert with correlation.
 */
@Injectable()
export class HcmContractorConnectorStagingWriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly correlation: ContractorCorrelationService,
    private readonly normalization: HcmContractorNormalizationService,
  ) {}

  async upsertRecords(
    organizationId: string,
    syncRunId: string,
    records: HcmExtractRecord[],
  ): Promise<HcmConnectorStagingWriteResult> {
    const summary: HcmConnectorStagingSummary = {
      imported: 0,
      matched: 0,
      possibleMatch: 0,
      new: 0,
      conflict: 0,
      correlationFailures: 0,
      failed: 0,
    };
    const stagingIds: string[] = [];

    for (const record of records) {
      try {
        const sourceHash = computeHcmSourceHash(record.sourcePayload);
        const sourcePersonId = record.sourcePersonId.trim();

        const outcome = this.applyDemoScenarioCorrelationOverride(
          record,
          await this.correlation.correlate({
            organizationId,
            sourcePersonId,
            sourcePersonNumber: record.sourcePersonNumber,
            sourcePayload: record.sourcePayload,
          }),
        );

        const normalizedPayloadJson = this.normalization.normalize(
          record.sourcePayload,
          {
            sourcePersonId,
            sourcePersonNumber: record.sourcePersonNumber ?? null,
          },
        ) as unknown as Prisma.InputJsonValue;

        const upserted = await this.prisma.hcmContractorStaging.upsert({
          where: {
            organizationId_sourceSystem_sourcePersonId: {
              organizationId,
              sourceSystem: MigrationSourceSystem.ORACLE_HCM,
              sourcePersonId,
            },
          },
          create: {
            organizationId,
            contractorSourceSyncRunId: syncRunId,
            sourceSystem: MigrationSourceSystem.ORACLE_HCM,
            sourcePersonId,
            sourcePersonNumber: record.sourcePersonNumber ?? null,
            sourcePayloadJson: record.sourcePayload as unknown as Prisma.InputJsonValue,
            normalizedPayloadJson,
            sourceHash,
            extractTimestamp: record.extractTimestamp ?? new Date(),
            recordAction: record.recordAction ?? HcmStagingRecordAction.SNAPSHOT,
            pipelineStatus: HcmMigrationPipelineStatus.EXTRACTED,
            validationStatus: HcmStagingValidationStatus.PENDING,
            correlationMatchStatus: outcome.matchStatus,
            correlationConfidence: outcome.confidence,
            correlationMatchReason: outcome.matchReason,
            proposedContractorId: outcome.proposedContractorId,
          },
          update: {
            contractorSourceSyncRunId: syncRunId,
            sourcePersonNumber: record.sourcePersonNumber ?? null,
            sourcePayloadJson: record.sourcePayload as unknown as Prisma.InputJsonValue,
            normalizedPayloadJson,
            sourceHash,
            extractTimestamp: record.extractTimestamp ?? new Date(),
            recordAction: record.recordAction ?? HcmStagingRecordAction.SNAPSHOT,
            pipelineStatus: HcmMigrationPipelineStatus.EXTRACTED,
            validationStatus: HcmStagingValidationStatus.PENDING,
            correlationMatchStatus: outcome.matchStatus,
            correlationConfidence: outcome.confidence,
            correlationMatchReason: outcome.matchReason,
            proposedContractorId: outcome.proposedContractorId,
          },
        });

        stagingIds.push(upserted.id);
        summary.imported += 1;

        switch (outcome.matchStatus) {
          case HcmContractorCorrelationMatchStatus.MATCHED:
            summary.matched += 1;
            break;
          case HcmContractorCorrelationMatchStatus.POSSIBLE_MATCH:
            summary.possibleMatch += 1;
            break;
          case HcmContractorCorrelationMatchStatus.CONFLICT:
            summary.conflict += 1;
            summary.correlationFailures += 1;
            break;
          default:
            summary.new += 1;
        }
      } catch {
        summary.failed += 1;
      }
    }

    return { summary, stagingIds };
  }

  private applyDemoScenarioCorrelationOverride(
    record: HcmExtractRecord,
    outcome: ContractorCorrelationOutcome,
  ): ContractorCorrelationOutcome {
    const demoMode = this.config.get<string>('DEMO_MODE') === 'true';
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    if (!demoMode && nodeEnv === 'production') {
      return outcome;
    }

    const scenario = extractDemoWorkerScenarioFromPayload(record.sourcePayload);
    if (!scenario) {
      return outcome;
    }

    switch (scenario) {
      case 'duplicate_hcm_person_conflict':
        return {
          matchStatus: HcmContractorCorrelationMatchStatus.CONFLICT,
          confidence: HcmContractorCorrelationConfidence.MANUAL_REVIEW,
          proposedContractorId: null,
          matchReason: 'Demo: duplicate HCM person anchor requires manual review',
        };
      case 'manual_review_identity_conflict':
        return {
          matchStatus: HcmContractorCorrelationMatchStatus.POSSIBLE_MATCH,
          confidence: HcmContractorCorrelationConfidence.MANUAL_REVIEW,
          proposedContractorId: null,
          matchReason: 'Demo: identity correlation requires manual review',
        };
      default:
        return outcome;
    }
  }
}
