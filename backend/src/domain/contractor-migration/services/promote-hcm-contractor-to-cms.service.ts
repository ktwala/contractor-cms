import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AcquisitionModel,
  ContractorCanonicalizationStatus,
  ContractorIdentityMapStatus,
  ContractorMigrationAuditAction,
  ContractorMigrationStatus,
  ContractorWorkforceHistorySource,
  ContractorWorkforceState,
  EngagementModel,
  HcmMigrationPipelineStatus,
  HcmResponsibleManagerValidationStatus,
  HcmStagingValidationStatus,
  MigrationSourceSystem,
  Prisma,
  ResponsibleManagerAccountabilityStatus,
  SupplierStatus,
} from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AccessIntegrationPublishService } from '../../access-integration/access-integration-publish.service';
import {
  buildHcmBootstrapHistoryMetadata,
  HCM_BOOTSTRAP_WORKFORCE_HISTORY_REASON,
} from '../../contractors/contractor-workforce-history.constants';
import { ContractorWorkforceHistoryService } from '../../contractors/contractor-workforce-history.service';
import { deriveIsActiveFromWorkforceState } from '../../contractors/contractor-workforce-state.constants';
import { PROMOTION_ERROR } from '../constants/promotion-error-codes';
import { isSupplierOperationalTrustGranted } from '../../suppliers/supplier-operational-trust.util';
import type {
  PromoteHcmContractorOptions,
  PromoteHcmContractorToCms,
  PromotionResult,
} from '../contracts/promote-hcm-contractor.contract';
import type { NormalizedHcmContractor } from '../types/hcm-normalized-contractor.types';
import { HCM_BOOTSTRAP_WORKER_CLASSIFICATION } from '../../contractors/worker-classification.constants';
import { resolveAcquisitionModelFromSupplierId } from '../../contractors/acquisition-model.constants';
import { HcmContractorNormalizationService } from './hcm-contractor-normalization.service';
import { CtrSequenceService } from './ctr-sequence.service';

@Injectable()
export class PromoteHcmContractorToCmsService implements PromoteHcmContractorToCms {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: HcmContractorNormalizationService,
    private readonly ctrSequence: CtrSequenceService,
    private readonly accessIntegrationPublish: AccessIntegrationPublishService,
    private readonly workforceHistory: ContractorWorkforceHistoryService,
  ) {}

  async execute(
    stagingId: string,
    options?: PromoteHcmContractorOptions,
  ): Promise<PromotionResult> {
    const preflight = await this.assertPromotable(stagingId, options);
    if (!preflight.ok) {
      return preflight.result;
    }

    if (options?.dryRun) {
      return {
        success: true,
        stagingId,
        message: 'Dry-run promote checks passed',
      };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.hcmContractorStaging.findUnique({
          where: { id: stagingId },
        });
        if (!row) {
          return this.fail(stagingId, PROMOTION_ERROR.STAGING_NOT_FOUND, 'Staging row not found');
        }

        const gate = this.evaluatePromoteGate(stagingId, row, options);
        if (!gate.ok) {
          return gate.result;
        }

        const normalized = this.readNormalized(row);
        const supplierId = await this.resolveSupplierId(
          tx,
          row.organizationId,
          normalized,
        );
        const vendorRef = normalized.supplier?.trim();
        if (vendorRef && !supplierId) {
          return this.fail(
            stagingId,
            PROMOTION_ERROR.SUPPLIER_UNRESOLVED,
            'Could not resolve supplier for HCM vendor reference',
          );
        }
        if (supplierId) {
          const supplier = await tx.supplier.findUnique({
            where: { id: supplierId },
            select: { status: true, tradingName: true, companyName: true },
          });
          if (
            supplier &&
            !isSupplierOperationalTrustGranted(supplier.status)
          ) {
            return this.fail(
              stagingId,
              PROMOTION_ERROR.SUPPLIER_OPERATIONAL_TRUST_NOT_GRANTED,
              'Supplier Operational Trust not granted',
            );
          }
        }

        const acquisitionModel = resolveAcquisitionModelFromSupplierId(supplierId);

        const duplicate = await this.findDuplicateConflict(
          tx,
          row.organizationId,
          row.sourcePersonId,
          normalized.email,
          supplierId,
        );
        if (duplicate) {
          return this.fail(
            stagingId,
            PROMOTION_ERROR.DUPLICATE_IDENTITY,
            duplicate,
          );
        }

        const existing = await tx.contractor.findFirst({
          where: {
            legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
            legacySourcePersonId: row.sourcePersonId,
            organizationId: row.organizationId,
          },
        });

        const contractorBusinessId = existing?.contractorBusinessId
          ? existing.contractorBusinessId
          : await this.ctrSequence.issueNext(
              tx,
              row.organizationId,
              stagingId,
            );

        const { firstName, lastName } = this.splitName(normalized);
        const now = new Date();

        const contractor = existing
          ? await tx.contractor.update({
              where: { id: existing.id },
              data: {
                firstName,
                lastName,
                email: normalized.email!,
                acquisitionModel,
                supplierId,
                organizationId: row.organizationId,
                workforceState: ContractorWorkforceState.ACTIVE,
                isActive: deriveIsActiveFromWorkforceState(ContractorWorkforceState.ACTIVE),
                contractorBusinessId,
                legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
                legacySourcePersonId: row.sourcePersonId,
                migrationBatchId: row.migrationBatchId,
                migrationStatus: ContractorMigrationStatus.PROMOTED,
                canonicalizationStatus: options?.governanceOverride
                  ? ContractorCanonicalizationStatus.OVERRIDE
                  : ContractorCanonicalizationStatus.CANONICAL,
                authoritativeUntil: now,
                externalPersonId: row.sourcePersonId,
              },
            })
          : await tx.contractor.create({
              data: {
                organizationId: row.organizationId,
                supplierId,
                acquisitionModel,
                firstName,
                lastName,
                email: normalized.email!,
                engagementModel: EngagementModel.DIRECT,
                workerClassification: HCM_BOOTSTRAP_WORKER_CLASSIFICATION,
                taxResidency: normalized.location?.slice(0, 2) ?? 'ZA',
                skills: [],
                workforceState: ContractorWorkforceState.ACTIVE,
                isActive: deriveIsActiveFromWorkforceState(ContractorWorkforceState.ACTIVE),
                contractorBusinessId,
                legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
                legacySourcePersonId: row.sourcePersonId,
                migrationBatchId: row.migrationBatchId,
                migrationStatus: ContractorMigrationStatus.PROMOTED,
                canonicalizationStatus: options?.governanceOverride
                  ? ContractorCanonicalizationStatus.OVERRIDE
                  : ContractorCanonicalizationStatus.CANONICAL,
                authoritativeUntil: now,
                externalPersonId: row.sourcePersonId,
              },
            });

        const startDate = normalized.startDate
          ? new Date(normalized.startDate)
          : new Date();
        const endDate = normalized.endDate
          ? new Date(normalized.endDate)
          : undefined;

        const engagement = await this.upsertPromotedEngagement(
          tx,
          {
            contractorId: contractor.id,
            organizationId: row.organizationId,
            supplierId,
            acquisitionModel,
            normalized,
            startDate,
            endDate,
          },
        );

        await this.workforceHistory.recordTransition({
          tx,
          contractorId: contractor.id,
          organizationId: row.organizationId,
          fromState: null,
          toState: ContractorWorkforceState.ACTIVE,
          actorUserId: options?.governanceOverride?.actorUserId ?? null,
          reason: HCM_BOOTSTRAP_WORKFORCE_HISTORY_REASON,
          source: ContractorWorkforceHistorySource.HCM_BOOTSTRAP,
          effectiveAt: startDate,
          metadata: buildHcmBootstrapHistoryMetadata({
            stagingId,
            migrationBatchId: row.migrationBatchId,
            contractorSourceSyncRunId: row.contractorSourceSyncRunId,
            sourcePersonId: row.sourcePersonId,
            sourcePersonNumber: row.sourcePersonNumber,
            engagementId: engagement.id,
            legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
          }),
        });

        await tx.contractorIdentityMap.upsert({
          where: { contractorBusinessId },
          create: {
            contractorId: contractor.id,
            contractorBusinessId,
            legacyHcmPersonId: row.sourcePersonId,
            legacyHcmPersonNumber: row.sourcePersonNumber,
            externalPersonId: row.sourcePersonId,
            status: ContractorIdentityMapStatus.ACTIVE,
            authoritativeSource: MigrationSourceSystem.ORACLE_HCM,
          },
          update: {
            legacyHcmPersonNumber: row.sourcePersonNumber,
            externalPersonId: row.sourcePersonId,
            status: ContractorIdentityMapStatus.ACTIVE,
          },
        });

        await tx.contractorMigrationAudit.create({
          data: {
            organizationId: row.organizationId,
            migrationBatchId: row.migrationBatchId,
            stagingId,
            contractorId: contractor.id,
            action: ContractorMigrationAuditAction.PROMOTED,
            actorUserId: options?.governanceOverride?.actorUserId,
            detailsJson: {
              contractorBusinessId,
              engagementId: engagement.id,
              override: options?.governanceOverride ?? null,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.hcmContractorStaging.update({
          where: { id: stagingId },
          data: {
            validationStatus: HcmStagingValidationStatus.PROMOTED,
            pipelineStatus: HcmMigrationPipelineStatus.PROMOTED,
            promotedContractorId: contractor.id,
            promotedAt: now,
            issuedContractorBusinessId: contractorBusinessId,
          },
        });

        if (options?.publishToIga !== false) {
          await this.accessIntegrationPublish.publishAcquisitionMigratedIntent({
            organizationId: row.organizationId,
            tx,
            cmsContractorId: contractor.id,
            contractorBusinessId,
            legacyHcmPersonId: row.sourcePersonId,
            legacyHcmPersonNumber: row.sourcePersonNumber,
            responsibleManagerEmployeeId: normalized.responsibleManagerEmployeeId!,
            engagementId: engagement.id,
            migrationBatchId:
              row.migrationBatchId ?? row.contractorSourceSyncRunId ?? 'connector-sync',
          });

          await tx.hcmContractorStaging.update({
            where: { id: stagingId },
            data: {
              pipelineStatus: HcmMigrationPipelineStatus.IGA_PUBLISHED,
            },
          });

          await tx.contractorMigrationAudit.create({
            data: {
              organizationId: row.organizationId,
              migrationBatchId: row.migrationBatchId,
              stagingId,
              contractorId: contractor.id,
              action: ContractorMigrationAuditAction.IGA_PUBLISHED,
              actorUserId: options?.governanceOverride?.actorUserId,
              detailsJson: {
                contractorBusinessId,
                engagementId: engagement.id,
                publishIntent: 'contractor.migrated',
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }

        return {
          success: true,
          stagingId,
          contractorId: contractor.id,
          contractorBusinessId,
          engagementId: engagement.id,
        };
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Promotion transaction failed';
      throw new BadRequestException(message);
    }
  }

  private async assertPromotable(
    stagingId: string,
    options?: PromoteHcmContractorOptions,
  ): Promise<{ ok: true } | { ok: false; result: PromotionResult }> {
    const row = await this.prisma.hcmContractorStaging.findUnique({
      where: { id: stagingId },
    });
    if (!row) {
      return {
        ok: false,
        result: this.fail(
          stagingId,
          PROMOTION_ERROR.STAGING_NOT_FOUND,
          'Staging row not found',
        ),
      };
    }
    const gate = this.evaluatePromoteGate(stagingId, row, options);
    if (!gate.ok) {
      return { ok: false, result: gate.result };
    }
    return { ok: true };
  }

  private evaluatePromoteGate(
    stagingId: string,
    row: {
      validationStatus: HcmStagingValidationStatus;
      pipelineStatus: HcmMigrationPipelineStatus;
      responsibleManagerValidationStatus: HcmResponsibleManagerValidationStatus | null;
      sourcePersonId: string;
    },
    options?: PromoteHcmContractorOptions,
  ): { ok: true } | { ok: false; result: PromotionResult } {
    if (
      row.validationStatus === HcmStagingValidationStatus.PROMOTED ||
      row.pipelineStatus === HcmMigrationPipelineStatus.PROMOTED
    ) {
      return {
        ok: false,
        result: this.fail(
          stagingId,
          PROMOTION_ERROR.ALREADY_PROMOTED,
          'Staging row is already promoted',
        ),
      };
    }

    if (row.validationStatus !== HcmStagingValidationStatus.PASSED) {
      return {
        ok: false,
        result: this.fail(
          stagingId,
          PROMOTION_ERROR.NOT_PASSED,
          `Staging validation_status must be PASSED (got ${row.validationStatus})`,
        ),
      };
    }

    if (
      row.pipelineStatus === HcmMigrationPipelineStatus.QUARANTINED ||
      row.pipelineStatus === HcmMigrationPipelineStatus.EXTRACTED
    ) {
      return {
        ok: false,
        result: this.fail(
          stagingId,
          PROMOTION_ERROR.INVALID_PIPELINE,
          `Invalid pipeline_status for promote: ${row.pipelineStatus}`,
        ),
      };
    }

    if (!row.sourcePersonId?.trim()) {
      return {
        ok: false,
        result: this.fail(
          stagingId,
          PROMOTION_ERROR.MISSING_SOURCE_PERSON_ID,
          'sourcePersonId is required',
        ),
      };
    }

    if (
      row.responsibleManagerValidationStatus !== HcmResponsibleManagerValidationStatus.VALID &&
      !options?.governanceOverride
    ) {
      return {
        ok: false,
        result: this.fail(
          stagingId,
          PROMOTION_ERROR.RESPONSIBLE_MANAGER_NOT_VALID,
          'Sponsor must be VALID on staging row (or use governance override)',
        ),
      };
    }

    return { ok: true };
  }

  private readNormalized(row: {
    normalizedPayloadJson: unknown;
    sourcePayloadJson: unknown;
    sourcePersonId: string;
    sourcePersonNumber: string | null;
  }): NormalizedHcmContractor {
    const normalized =
      (row.normalizedPayloadJson as NormalizedHcmContractor | null) ??
      this.normalization.normalize(row.sourcePayloadJson, {
        sourcePersonId: row.sourcePersonId,
        sourcePersonNumber: row.sourcePersonNumber,
      });

    if (!normalized.email?.trim() || !normalized.responsibleManagerEmployeeId?.trim()) {
      throw new BadRequestException(
        'Normalized payload missing required email or sponsor',
      );
    }

    return normalized;
  }

  private async resolveSupplierId(
    tx: Prisma.TransactionClient,
    organizationId: string,
    normalized: NormalizedHcmContractor,
  ): Promise<string | null> {
    const vendor = normalized.supplier?.trim();
    if (!vendor) {
      return null;
    }

    const suppliers = await tx.supplier.findMany({
      where: { organizationId },
      select: { id: true, companyName: true, tradingName: true },
    });

    const needle = vendor.toLowerCase();
    const match = suppliers.find(
      (s) =>
        s.companyName?.toLowerCase().includes(needle) ||
        s.tradingName?.toLowerCase().includes(needle),
    );
    return match?.id ?? null;
  }

  private async upsertPromotedEngagement(
    tx: Prisma.TransactionClient,
    params: {
      contractorId: string;
      organizationId: string;
      supplierId: string | null;
      acquisitionModel: AcquisitionModel;
      normalized: NormalizedHcmContractor;
      startDate: Date;
      endDate?: Date;
    },
  ) {
    const role = params.normalized.workerType ?? 'Contractor';
    const responsibleManagerEmployeeId = params.normalized.responsibleManagerEmployeeId!;
    const engagementBase = {
      startDate: params.startDate,
      endDate: params.endDate,
      role,
      responsibleManagerValidationStatus: HcmResponsibleManagerValidationStatus.VALID,
      responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
      isActive: true,
    };

    if (params.acquisitionModel === AcquisitionModel.SUPPLIER) {
      const contract = await tx.supplierContract.findFirst({
        where: {
          supplierId: params.supplierId!,
          organizationId: params.organizationId,
          status: 'ACTIVE',
        },
        orderBy: { startDate: 'desc' },
      });
      if (!contract) {
        throw new BadRequestException(
          'No active supplier contract for engagement placement',
        );
      }

      const existingEngagement = await tx.contractorEngagement.findFirst({
        where: {
          contractorId: params.contractorId,
          contractId: contract.id,
          responsibleManagerEmployeeId,
        },
      });

      if (existingEngagement) {
        return tx.contractorEngagement.update({
          where: { id: existingEngagement.id },
          data: engagementBase,
        });
      }

      return tx.contractorEngagement.create({
        data: {
          contractorId: params.contractorId,
          contractId: contract.id,
          rateType: 'HOURLY',
          rateAmount: new Prisma.Decimal(0),
          responsibleManagerEmployeeId,
          ...engagementBase,
        },
      });
    }

    const existingEngagement = await tx.contractorEngagement.findFirst({
      where: {
        contractorId: params.contractorId,
        contractId: null,
        responsibleManagerEmployeeId,
      },
    });

    if (existingEngagement) {
      return tx.contractorEngagement.update({
        where: { id: existingEngagement.id },
        data: engagementBase,
      });
    }

    return tx.contractorEngagement.create({
      data: {
        contractorId: params.contractorId,
        rateType: 'HOURLY',
        rateAmount: new Prisma.Decimal(0),
        responsibleManagerEmployeeId,
        ...engagementBase,
      },
    });
  }

  private async findDuplicateConflict(
    tx: Prisma.TransactionClient,
    organizationId: string,
    sourcePersonId: string,
    email: string | null,
    supplierId: string | null,
  ): Promise<string | null> {
    const legacyOther = await tx.contractor.findFirst({
      where: {
        legacySourcePersonId: sourcePersonId,
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        organizationId,
        migrationStatus: ContractorMigrationStatus.PROMOTED,
      },
    });

    if (email) {
      const emailDup = await tx.contractor.findFirst({
        where: {
          email,
          organizationId,
          ...(supplierId != null
            ? { supplierId }
            : { acquisitionModel: AcquisitionModel.INDEPENDENT }),
          ...(legacyOther ? { id: { not: legacyOther.id } } : {}),
        },
      });
      if (emailDup && emailDup.legacySourcePersonId !== sourcePersonId) {
        return `Email ${email} already assigned to another contractor`;
      }
    }

    return null;
  }

  private splitName(normalized: NormalizedHcmContractor): {
    firstName: string;
    lastName: string;
  } {
    if (normalized.displayName) {
      const parts = normalized.displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return {
          firstName: parts[0],
          lastName: parts.slice(1).join(' '),
        };
      }
      return { firstName: parts[0] ?? 'Unknown', lastName: 'Contractor' };
    }
    return { firstName: 'Unknown', lastName: 'Contractor' };
  }

  private fail(
    stagingId: string,
    errorCode: string,
    message: string,
  ): PromotionResult {
    return {
      success: false,
      stagingId,
      errorCode,
      message,
    };
  }
}
