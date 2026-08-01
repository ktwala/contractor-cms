import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContractorMigrationAuditAction,
  HcmMigrationPipelineStatus,
  HcmResponsibleManagerValidationStatus,
  HcmStagingValidationStatus,
  Prisma,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { HcmResponsibleManagerLookupService } from '../../../core/hcm/hcm-responsible-manager-lookup.service';
import {
  HCM_VALIDATION_REASON,
  HcmValidationIssue,
} from '../constants/hcm-validation-reason-codes';
import {
  isActiveAssignmentStatus,
  SUPPORTED_ASSIGNMENT_STATUSES,
  SUPPORTED_HCM_WORKER_TYPES,
} from '../constants/hcm-worker-types';
import type {
  ValidateHcmStagingRowInput,
  ValidateHcmStagingRowResult,
} from '../contracts/migration-pipeline.contract';
import type { NormalizedHcmContractor } from '../types/hcm-normalized-contractor.types';
import { HcmContractorNormalizationService } from './hcm-contractor-normalization.service';
import { HcmStagingQuarantineService } from './hcm-staging-quarantine.service';

@Injectable()
export class HcmStagingValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: HcmContractorNormalizationService,
    private readonly quarantine: HcmStagingQuarantineService,
    private readonly hcmResponsibleManager: HcmResponsibleManagerLookupService,
  ) {}

  async normalize(stagingId: string): Promise<HcmMigrationPipelineStatus> {
    const row = await this.requireStagingRow(stagingId);

    const normalized = this.normalization.normalize(row.sourcePayloadJson, {
      sourcePersonId: row.sourcePersonId,
      sourcePersonNumber: row.sourcePersonNumber,
    });

    await this.prisma.$transaction([
      this.prisma.hcmContractorStaging.update({
        where: { id: stagingId },
        data: {
          normalizedPayloadJson: normalized as unknown as Prisma.InputJsonValue,
          pipelineStatus: HcmMigrationPipelineStatus.NORMALIZED,
        },
      }),
      this.prisma.contractorMigrationAudit.create({
        data: {
          organizationId: row.organizationId,
          migrationBatchId: row.migrationBatchId,
          stagingId,
          action: ContractorMigrationAuditAction.NORMALIZED,
        },
      }),
    ]);

    return HcmMigrationPipelineStatus.NORMALIZED;
  }

  async validate(
    input: ValidateHcmStagingRowInput,
  ): Promise<ValidateHcmStagingRowResult> {
    const row = await this.requireStagingRow(input.stagingId);

    if (row.validationStatus === HcmStagingValidationStatus.PROMOTED) {
      throw new Error(
        'Cannot re-validate a PROMOTED staging row (PR-CTR-5 only)',
      );
    }

    if (row.pipelineStatus === HcmMigrationPipelineStatus.EXTRACTED) {
      await this.normalize(input.stagingId);
    }

    const refreshed = await this.requireStagingRow(input.stagingId);
    const normalized =
      (refreshed.normalizedPayloadJson as unknown as NormalizedHcmContractor | null) ??
      this.normalization.normalize(refreshed.sourcePayloadJson, {
        sourcePersonId: refreshed.sourcePersonId,
        sourcePersonNumber: refreshed.sourcePersonNumber,
      });

    const issues = await this.collectValidationIssues(
      refreshed.organizationId,
      refreshed.id,
      refreshed.migrationBatchId,
      refreshed.sourcePersonId,
      normalized,
    );

    const responsibleManagerValidationStatus = this.resolveResponsibleManagerValidationStatus(
      normalized,
      issues,
    );

    const blocking = issues.filter((i) => i.severity === 'ERROR');
    let validationStatus: HcmStagingValidationStatus;
    let pipelineStatus: HcmMigrationPipelineStatus;

    if (blocking.length === 0) {
      validationStatus = HcmStagingValidationStatus.PASSED;
      pipelineStatus = HcmMigrationPipelineStatus.VALIDATED;
    } else {
      const quarantineCodes = new Set<string>(Object.values(HCM_VALIDATION_REASON));
      const shouldQuarantine = blocking.some((i) =>
        quarantineCodes.has(i.code),
      );
      validationStatus = shouldQuarantine
        ? HcmStagingValidationStatus.QUARANTINED
        : HcmStagingValidationStatus.FAILED;
      pipelineStatus = shouldQuarantine
        ? HcmMigrationPipelineStatus.QUARANTINED
        : HcmMigrationPipelineStatus.VALIDATED;
    }

    if (!input.dryRun) {
      await this.prisma.hcmContractorStaging.update({
        where: { id: input.stagingId },
        data: {
          validationStatus,
          pipelineStatus,
          validationErrorsJson: blocking.length
            ? (blocking as object[])
            : undefined,
          responsibleManagerValidationStatus,
        },
      });

      await this.prisma.contractorMigrationAudit.create({
        data: {
          organizationId: refreshed.organizationId,
          migrationBatchId: refreshed.migrationBatchId,
          stagingId: input.stagingId,
          action: ContractorMigrationAuditAction.VALIDATED,
          detailsJson: {
            validationStatus,
            issueCount: blocking.length,
          },
        },
      });

      if (validationStatus === HcmStagingValidationStatus.QUARANTINED) {
        await this.quarantine.writeQuarantine(
          input.stagingId,
          refreshed.organizationId,
          blocking,
        );
      }
    }

    return {
      validationStatus,
      pipelineStatus,
      responsibleManagerValidationStatus,
      errors: blocking,
      quarantineReasonCodes: blocking.map((i) => i.code),
    };
  }

  private async requireStagingRow(stagingId: string) {
    const row = await this.prisma.hcmContractorStaging.findUnique({
      where: { id: stagingId },
    });
    if (!row) {
      throw new NotFoundException(`Staging row not found: ${stagingId}`);
    }
    return row;
  }

  private resolveResponsibleManagerValidationStatus(
    normalized: NormalizedHcmContractor,
    issues: HcmValidationIssue[],
  ): HcmResponsibleManagerValidationStatus | null {
    const sponsorIssue = issues.find(
      (i) =>
        i.code === HCM_VALIDATION_REASON.MISSING_RESPONSIBLE_MANAGER ||
        i.code === HCM_VALIDATION_REASON.RESPONSIBLE_MANAGER_NOT_FOUND ||
        i.code === HCM_VALIDATION_REASON.RESPONSIBLE_MANAGER_INACTIVE,
    );
    if (sponsorIssue?.code === HCM_VALIDATION_REASON.MISSING_RESPONSIBLE_MANAGER) {
      return HcmResponsibleManagerValidationStatus.MISSING;
    }
    if (sponsorIssue?.code === HCM_VALIDATION_REASON.RESPONSIBLE_MANAGER_INACTIVE) {
      return HcmResponsibleManagerValidationStatus.INACTIVE;
    }
    if (sponsorIssue?.code === HCM_VALIDATION_REASON.RESPONSIBLE_MANAGER_NOT_FOUND) {
      return HcmResponsibleManagerValidationStatus.UNKNOWN;
    }
    if (normalized.responsibleManagerEmployeeId?.trim()) {
      return HcmResponsibleManagerValidationStatus.VALID;
    }
    return null;
  }

  private async collectValidationIssues(
    organizationId: string,
    stagingId: string,
    migrationBatchId: string | null,
    sourcePersonId: string,
    normalized: NormalizedHcmContractor,
  ): Promise<HcmValidationIssue[]> {
    const issues: HcmValidationIssue[] = [];

    if (!sourcePersonId?.trim()) {
      issues.push(this.issue(
        HCM_VALIDATION_REASON.MISSING_SOURCE_PERSON_ID,
        'sourcePersonId',
        'HCM person_id is required for migration correlation.',
        'Include person_id from Oracle HCM extract.',
      ));
    }

    if (!normalized.sourcePersonNumber?.trim()) {
      issues.push(this.issue(
        HCM_VALIDATION_REASON.MISSING_SOURCE_PERSON_NUMBER,
        'sourcePersonNumber',
        'HCM person_number is missing.',
        'Include person_number for operational search and audit.',
        'WARN',
      ));
    }

    const workerType = normalized.workerType?.trim().toLowerCase() ?? '';
    if (!workerType || !SUPPORTED_HCM_WORKER_TYPES.has(workerType)) {
      issues.push(this.issue(
        HCM_VALIDATION_REASON.UNSUPPORTED_WORKER_TYPE,
        'workerType',
        `Worker type "${normalized.workerType ?? ''}" is not a supported contractor/contingent worker.`,
        'Map Oracle assignment type to contingent worker before import.',
      ));
    }

    if (!normalized.startDate) {
      issues.push(this.issue(
        HCM_VALIDATION_REASON.MISSING_START_DATE,
        'startDate',
        'Assignment start date is required.',
        'Provide start_date or assignment_start_date from HCM.',
      ));
    }

    if (normalized.startDate && normalized.endDate) {
      if (normalized.endDate < normalized.startDate) {
        issues.push(this.issue(
          HCM_VALIDATION_REASON.INVALID_DATE_RANGE,
          'endDate',
          'End date is before start date.',
          'Correct assignment dates in HCM and re-extract.',
        ));
      }
    }

    const status = normalized.assignmentStatus?.trim().toLowerCase() ?? '';
    if (status && !SUPPORTED_ASSIGNMENT_STATUSES.has(status)) {
      issues.push(this.issue(
        HCM_VALIDATION_REASON.INVALID_STATUS,
        'assignmentStatus',
        `Assignment status "${normalized.assignmentStatus}" is not recognized.`,
        'Use Active, Inactive, or Terminated from HCM.',
      ));
    }

    if (isActiveAssignmentStatus(normalized.assignmentStatus)) {
      if (!normalized.email?.trim()) {
        issues.push(this.issue(
          HCM_VALIDATION_REASON.MISSING_EMAIL,
          'email',
          'Active contractors require an email for identity correlation.',
          'Populate work email in HCM.',
        ));
      }

      if (!normalized.responsibleManagerEmployeeId?.trim()) {
        issues.push(this.issue(
          HCM_VALIDATION_REASON.MISSING_RESPONSIBLE_MANAGER,
          'responsibleManagerEmployeeId',
          'Active contractor placements require a business sponsor.',
          'Assign sponsor in HCM or correct normalized sponsor_employee_id.',
        ));
      } else {
        await this.validateResponsibleManager(
          organizationId,
          normalized.responsibleManagerEmployeeId,
          issues,
        );
      }
    }

    const duplicatePerson = await this.prisma.hcmContractorStaging.count({
      where: {
        organizationId,
        sourcePersonId,
        id: { not: stagingId },
        validationStatus: {
          in: [
            HcmStagingValidationStatus.PASSED,
            HcmStagingValidationStatus.PENDING,
          ],
        },
      },
    });
    if (duplicatePerson > 0) {
      issues.push(this.issue(
        HCM_VALIDATION_REASON.DUPLICATE_SOURCE_PERSON,
        'sourcePersonId',
        `Another staging row exists for HCM person ${sourcePersonId}.`,
        'Deduplicate extract or merge batches before validation.',
      ));
    }

    if (normalized.email) {
      const suppliers = await this.prisma.supplier.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const supplierIds = suppliers.map((s) => s.id);

      if (supplierIds.length > 0) {
        const existingContractor = await this.prisma.contractor.findFirst({
          where: {
            supplierId: { in: supplierIds },
            email: normalized.email,
          },
        });
        if (existingContractor) {
          issues.push(this.issue(
            HCM_VALIDATION_REASON.DUPLICATE_EMAIL,
            'email',
            `Email ${normalized.email} already exists on an operational contractor.`,
            'Link to existing contractor via identity map in PR-CTR-5, or resolve duplicate in HCM.',
          ));
        }
      }

      if (migrationBatchId) {
        const duplicateStagingEmail =
          await this.prisma.hcmContractorStaging.count({
            where: {
              organizationId,
              id: { not: stagingId },
              migrationBatchId,
              validationStatus: HcmStagingValidationStatus.PASSED,
              normalizedPayloadJson: {
                path: ['email'],
                equals: normalized.email,
              },
            },
          });
        if (duplicateStagingEmail > 0) {
          issues.push(this.issue(
            HCM_VALIDATION_REASON.DUPLICATE_EMAIL,
            'email',
            `Another PASSED staging row in this batch uses email ${normalized.email}.`,
            'Remove duplicate rows from the batch extract.',
          ));
        }
      }

      const internalUser = await this.prisma.user.findFirst({
        where: {
          organizationId,
          email: normalized.email,
          userType: UserType.INTERNAL,
          isActive: true,
        },
      });
      if (internalUser) {
        issues.push(this.issue(
          HCM_VALIDATION_REASON.EMPLOYEE_CONTRACTOR_COLLISION,
          'email',
          `Email ${normalized.email} belongs to an active internal employee.`,
          'Resolve identity collision in HCM/HR before contractor migration.',
        ));
      }
    }

    await this.checkOverlappingEngagements(
      organizationId,
      stagingId,
      sourcePersonId,
      normalized,
      issues,
    );

    return issues;
  }

  private async validateResponsibleManager(
    organizationId: string,
    responsibleManagerEmployeeId: string,
    issues: HcmValidationIssue[],
  ): Promise<void> {
    if (!this.hcmResponsibleManager.isValidationEnabled()) {
      return;
    }

    if (!this.hcmResponsibleManager.validateReferenceFormat(responsibleManagerEmployeeId)) {
      issues.push(this.issue(
        HCM_VALIDATION_REASON.RESPONSIBLE_MANAGER_NOT_FOUND,
        'responsibleManagerEmployeeId',
        `Sponsor reference "${responsibleManagerEmployeeId}" failed format validation.`,
        'Use a valid HCM employee reference (see HCM_SPONSOR_REFERENCE_PATTERN).',
      ));
      return;
    }

    const exists = await this.hcmResponsibleManager.responsibleManagerExists(
      organizationId,
      responsibleManagerEmployeeId,
    );
    if (!exists) {
      issues.push(this.issue(
        HCM_VALIDATION_REASON.RESPONSIBLE_MANAGER_INACTIVE,
        'responsibleManagerEmployeeId',
        `Sponsor "${responsibleManagerEmployeeId}" is not active or not found in HCM.`,
        'Assign an active sponsor in HCM before migration.',
      ));
    }
  }

  private async checkOverlappingEngagements(
    organizationId: string,
    stagingId: string,
    sourcePersonId: string,
    normalized: NormalizedHcmContractor,
    issues: HcmValidationIssue[],
  ): Promise<void> {
    if (!normalized.startDate) {
      return;
    }

    const start = normalized.startDate;
    const end = normalized.endDate ?? '9999-12-31';

    const otherStaging = await this.prisma.hcmContractorStaging.findMany({
      where: {
        organizationId,
        sourcePersonId,
        id: { not: stagingId },
        validationStatus: {
          in: [
            HcmStagingValidationStatus.PASSED,
            HcmStagingValidationStatus.PENDING,
          ],
        },
      },
      select: { normalizedPayloadJson: true },
    });

    for (const other of otherStaging) {
      const otherNorm = other.normalizedPayloadJson as unknown as
        | NormalizedHcmContractor
        | null;
      if (!otherNorm?.startDate) continue;
      const otherEnd = otherNorm.endDate ?? '9999-12-31';
      if (start <= otherEnd && otherNorm.startDate <= end) {
        issues.push(this.issue(
          HCM_VALIDATION_REASON.OVERLAPPING_ENGAGEMENT,
          'startDate',
          `Overlapping assignment dates with another staging row for ${sourcePersonId}.`,
          'Resolve placement dates in HCM or end prior assignment.',
        ));
        break;
      }
    }

    const legacyContractor = await this.prisma.contractor.findFirst({
      where: {
        legacySourcePersonId: sourcePersonId,
        legacySourceSystem: 'ORACLE_HCM',
        supplier: { organizationId },
      },
      include: {
        engagements: {
          select: { startDate: true, endDate: true, isActive: true },
        },
      },
    });

    if (legacyContractor) {
      for (const eng of legacyContractor.engagements) {
        if (!eng.isActive) continue;
        const engStart = eng.startDate.toISOString().slice(0, 10);
        const engEnd = eng.endDate
          ? eng.endDate.toISOString().slice(0, 10)
          : '9999-12-31';
        if (start <= engEnd && engStart <= end) {
          issues.push(this.issue(
            HCM_VALIDATION_REASON.OVERLAPPING_ENGAGEMENT,
            'startDate',
            'Overlapping dates with an existing operational engagement.',
            'End or update the existing engagement before re-import.',
          ));
          break;
        }
      }
    }
  }

  private issue(
    code: (typeof HCM_VALIDATION_REASON)[keyof typeof HCM_VALIDATION_REASON],
    sourceField: string,
    message: string,
    remediationHint: string,
    severity: 'ERROR' | 'WARN' = 'ERROR',
  ): HcmValidationIssue {
    return { code, severity, sourceField, message, remediationHint };
  }
}
