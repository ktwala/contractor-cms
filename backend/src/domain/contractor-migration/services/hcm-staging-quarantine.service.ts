import { Injectable } from '@nestjs/common';
import {
  ContractorMigrationAuditAction,
  HcmQuarantineReasonCode,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  HcmValidationIssue,
  mapValidationCodeToQuarantineReason,
} from '../constants/hcm-validation-reason-codes';

export interface QuarantineDetailRecord {
  reasonCode: HcmQuarantineReasonCode;
  severity: string;
  sourceField?: string;
  message: string;
  remediationHint: string;
  validationCode: string;
}

/**
 * PR-CTR-2B — writes quarantine rows; does not promote or touch operational contractors.
 */
@Injectable()
export class HcmStagingQuarantineService {
  constructor(private readonly prisma: PrismaService) {}

  async writeQuarantine(
    stagingId: string,
    organizationId: string,
    issues: HcmValidationIssue[],
  ): Promise<void> {
    if (issues.length === 0) {
      return;
    }

    const byReason = new Map<HcmQuarantineReasonCode, HcmValidationIssue[]>();
    for (const issue of issues) {
      const reason = mapValidationCodeToQuarantineReason(issue.code);
      const list = byReason.get(reason) ?? [];
      list.push(issue);
      byReason.set(reason, list);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [reasonCode, group] of byReason.entries()) {
        const details: QuarantineDetailRecord[] = group.map((issue) => ({
          reasonCode,
          severity: issue.severity,
          sourceField: issue.sourceField,
          message: issue.message,
          remediationHint: issue.remediationHint,
          validationCode: issue.code,
        }));

        await tx.hcmContractorQuarantine.create({
          data: {
            organizationId,
            stagingId,
            reasonCode,
            detailsJson: { issues: details } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      await tx.contractorMigrationAudit.create({
        data: {
          organizationId,
          stagingId,
          action: ContractorMigrationAuditAction.QUARANTINED,
          detailsJson: {
            issueCount: issues.length,
            codes: issues.map((i) => i.code),
          },
        },
      });
    });
  }
}
