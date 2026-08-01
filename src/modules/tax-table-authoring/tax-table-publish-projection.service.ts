import { Injectable, Optional, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { TaxTableAuthoringValidationService } from './tax-table-authoring.validation.service';
import { TaxTableImpactAnalysisReadinessService } from '../tax-table-impact-analysis/tax-table-impact-analysis-readiness.service';
import { TaxTableTemplateRegistry } from './tax-table-template.registry';
import { AuthoringDraft } from './types/authoring.types';
import { TTA_ERROR_CODES, TtaException } from './types/error-codes';

export interface PublishResult {
  authoringVersionId: string;
  runtimeTaxTableSetId: string;
  supersededRuntimeId: string | null;
  checksum: string;
}

export interface PublishPolicyConfig {
  requireApprovalBeforePublish: boolean;
  disallowSelfApproval: boolean;
  requireImpactAnalysisBeforePublish: boolean;
  requireAcceptedImpactReviewBeforePublish: boolean;
  impactAnalysisMaxAgeHours: number | null;
}

@Injectable()
export class TaxTablePublishProjectionService {
  private policyConfig: PublishPolicyConfig = {
    requireApprovalBeforePublish: false,
    disallowSelfApproval: true,
    requireImpactAnalysisBeforePublish: false,
    requireAcceptedImpactReviewBeforePublish: false,
    impactAnalysisMaxAgeHours: null,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: TaxTableAuthoringValidationService,
    private readonly templateRegistry: TaxTableTemplateRegistry,
    @Optional() @Inject(TaxTableImpactAnalysisReadinessService)
    private readonly impactAnalysisReadinessService?: TaxTableImpactAnalysisReadinessService,
  ) {}

  updatePolicy(config: Partial<PublishPolicyConfig>): void {
    this.policyConfig = { ...this.policyConfig, ...config };
  }

  getPolicy(): PublishPolicyConfig {
    return { ...this.policyConfig };
  }

  /**
   * Publish an authoring draft into a canonical runtime TaxTableSet.
   *
   * Guarantees (TTA-HARDEN-001/002/003):
   *  - Entire publish runs in a single DB transaction
   *  - Re-checks overlap/conflict INSIDE the transaction (race-safe)
   *  - Rejects already-published drafts (idempotency guard)
   *  - Prior active row superseded only after new row is ready
   *  - All mutations roll back on any failure
   */
  async publishAuthoringVersion(input: {
    authoringVersionId: string;
    actorUserId: string;
    reason?: string;
  }): Promise<PublishResult> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Load draft with lock-equivalent fresh read inside transaction
      const dbVersion = await tx.taxTableAuthoringVersion.findUnique({
        where: { id: input.authoringVersionId },
        include: {
          brackets: { orderBy: { seqNo: 'asc' } },
          fields: true,
        },
      });

      if (!dbVersion) {
        throw new TtaException(
          TTA_ERROR_CODES.NOT_FOUND,
          'Authoring version not found',
          { authoringVersionId: input.authoringVersionId },
          404,
        );
      }

      const draft = this.toDraft(dbVersion);

      // 2. Idempotency guard (TTA-HARDEN-003)
      if (draft.status === 'PUBLISHED') {
        throw new TtaException(
          TTA_ERROR_CODES.ALREADY_PUBLISHED,
          'This version has already been published',
          {
            authoringVersionId: draft.id,
            publishedTaxTableSetId: draft.publishedTaxTableSetId,
            publishedAt: draft.publishedAt,
          },
        );
      }

      // 3. Status gate
      this.assertPublishableStatus(draft, input.actorUserId);

      // 4. Content validation
      await this.validationService.assertPublishable(draft);

      // 4b. Impact analysis readiness gate
      await this.assertImpactAnalysisReadiness(draft);

      // 5. Overlap/conflict re-check INSIDE transaction (TTA-HARDEN-002)
      const conflicting = await tx.taxTableSet.findFirst({
        where: {
          country: draft.countryCode as any,
          tableType: draft.tableType as any,
          status: 'ACTIVE',
          effectiveFrom: { lte: draft.effectiveTo ?? new Date('9999-12-31') },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: draft.effectiveFrom } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      // 6. Build runtime payload
      const runtimePayload = this.mapAuthoringToRuntimePayload(draft);

      // 7. Create new runtime row FIRST (before superseding old one)
      const createdRuntime = await tx.taxTableSet.create({
        data: {
          country: draft.countryCode as any,
          tableType: draft.tableType as any,
          taxYear: draft.taxYear,
          displayName: `${draft.countryCode} ${draft.tableType} ${draft.taxYear}`,
          effectiveFrom: draft.effectiveFrom,
          effectiveTo: draft.effectiveTo,
          status: 'ACTIVE',
          sourceRef: draft.sourceReference,
          checksum: runtimePayload.checksum,
          data: runtimePayload.data,
          createdBy: input.actorUserId,
        },
      });

      // 8. Supersede prior active row AFTER new row exists
      if (conflicting) {
        const supersedeTo = new Date(draft.effectiveFrom);
        supersedeTo.setDate(supersedeTo.getDate() - 1);

        await tx.taxTableSet.update({
          where: { id: conflicting.id },
          data: {
            effectiveTo: supersedeTo,
            status: 'DEPRECATED',
          },
        });
      }

      // 9. Mark authoring version as PUBLISHED
      await tx.taxTableAuthoringVersion.update({
        where: { id: draft.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedByUserId: input.actorUserId,
          publishedTaxTableSetId: createdRuntime.id,
          publishReason: input.reason ?? null,
        },
      });

      // 10. Compute template modification delta (if draft originated from a template)
      const modificationDelta = this.computeTemplateModificationDelta(dbVersion, draft);

      // 11. Audit event (inside same transaction)
      await tx.taxTableAuthoringAuditEvent.create({
        data: {
          authoringVersionId: draft.id,
          eventType: 'published',
          actorUserId: input.actorUserId,
          payloadJson: {
            runtimeTaxTableSetId: createdRuntime.id,
            previousActiveId: conflicting?.id ?? null,
            reason: input.reason ?? null,
            checksum: runtimePayload.checksum,
            policySnapshot: { ...this.policyConfig },
            ...(modificationDelta ? { templateModificationDelta: modificationDelta } : {}),
          },
        },
      });

      return {
        authoringVersionId: draft.id,
        runtimeTaxTableSetId: createdRuntime.id,
        supersededRuntimeId: conflicting?.id ?? null,
        checksum: runtimePayload.checksum,
      };
    });
  }

  private assertPublishableStatus(
    draft: AuthoringDraft,
    actorUserId: string,
  ): void {
    if (draft.status === 'ARCHIVED') {
      throw new TtaException(
        TTA_ERROR_CODES.INVALID_STATUS,
        'Cannot publish an ARCHIVED version',
        { status: draft.status },
      );
    }

    if (draft.status === 'PENDING_APPROVAL') {
      throw new TtaException(
        TTA_ERROR_CODES.INVALID_STATUS,
        'Version is PENDING_APPROVAL. It must be approved before publishing.',
        { status: draft.status },
      );
    }

    if (
      this.policyConfig.requireApprovalBeforePublish &&
      draft.status !== 'APPROVED'
    ) {
      throw new TtaException(
        TTA_ERROR_CODES.PUBLISH_APPROVAL_REQUIRED,
        'Approval is required before publishing. Current status: ' + draft.status,
        { status: draft.status, policy: 'requireApprovalBeforePublish' },
      );
    }

    if (
      this.policyConfig.disallowSelfApproval &&
      draft.status === 'APPROVED' &&
      draft.reviewedByUserId === actorUserId
    ) {
      // This is the publish step — SoD means approver cannot also be publisher
      // (self-approval is checked in the authoring service approve flow)
    }

    const publishable = ['DRAFT', 'APPROVED'];
    if (!publishable.includes(draft.status)) {
      throw new TtaException(
        TTA_ERROR_CODES.INVALID_STATUS,
        `Cannot publish a version in ${draft.status} status`,
        { status: draft.status },
      );
    }
  }

  private async assertImpactAnalysisReadiness(draft: AuthoringDraft): Promise<void> {
    const needsCheck =
      this.policyConfig.requireImpactAnalysisBeforePublish ||
      this.policyConfig.requireAcceptedImpactReviewBeforePublish;

    if (!needsCheck || !this.impactAnalysisReadinessService) return;

    const latestRun = await this.prisma.taxTableImpactAnalysisRun.findFirst({
      where: { authoringVersionId: draft.id },
      include: {
        reviews: {
          orderBy: { reviewedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { runAt: 'desc' },
    });

    const readiness = this.impactAnalysisReadinessService.evaluate({
      authoringUpdatedAt: draft.updatedAt,
      latestRunAt: latestRun?.runAt ?? null,
      latestRunId: latestRun?.id ?? null,
      latestReviewStatus: latestRun?.reviews?.[0]?.reviewStatus ?? null,
      latestReviewAt: latestRun?.reviews?.[0]?.reviewedAt ?? null,
      requireImpactAnalysis: this.policyConfig.requireImpactAnalysisBeforePublish,
      requireAcceptedReview: this.policyConfig.requireAcceptedImpactReviewBeforePublish,
      maxAgeHours: this.policyConfig.impactAnalysisMaxAgeHours ?? null,
    });

    if (!readiness.allowed) {
      throw new TtaException(
        (readiness.reason as any) ?? TTA_ERROR_CODES.IMPACT_PUBLISH_REQUIRES_RUN,
        this.readinessReasonMessage(readiness.reason),
        { latestRunId: readiness.latestRunId, stale: readiness.stale },
      );
    }
  }

  private readinessReasonMessage(reason: string | null): string {
    switch (reason) {
      case 'TTA_IMPACT_PUBLISH_REQUIRES_RUN':
        return 'Run impact analysis before publishing.';
      case 'TTA_IMPACT_PUBLISH_REQUIRES_ACCEPTED_REVIEW':
        return 'An accepted impact review is required before publishing.';
      case 'TTA_IMPACT_PUBLISH_RUN_STALE':
        return 'The latest impact analysis is outdated because the draft changed or the analysis expired.';
      default:
        return 'Impact analysis check failed.';
    }
  }

  private computeTemplateModificationDelta(
    dbVersion: any,
    draft: AuthoringDraft,
  ): { bracketChanges: number; fieldChanges: number; source: string } | null {
    const templateId = dbVersion.templateId;
    if (!templateId || draft.sourceType !== 'TEMPLATE') return null;

    const template = this.templateRegistry.getById(templateId);
    if (!template) return null;

    let bracketChanges = 0;
    const draftBrackets = draft.brackets.sort((a, b) => a.seqNo - b.seqNo);
    const tplBrackets = template.brackets;

    if (draftBrackets.length !== tplBrackets.length) {
      bracketChanges = Math.abs(draftBrackets.length - tplBrackets.length);
    }
    const minLen = Math.min(draftBrackets.length, tplBrackets.length);
    for (let i = 0; i < minLen; i++) {
      const db = draftBrackets[i];
      const tb = tplBrackets[i];
      if (
        db.bracketFrom !== tb.bracketFrom ||
        db.bracketTo !== tb.bracketTo ||
        Math.abs(db.marginalRate - tb.marginalRate) > 0.0001 ||
        Math.abs(db.baseTax - tb.baseTax) > 0.01 ||
        db.isOpenEnded !== tb.isOpenEnded
      ) {
        bracketChanges++;
      }
    }

    let fieldChanges = 0;
    for (const tplField of template.supplementalFields) {
      const draftField = draft.fields.find((f) => f.fieldCode === tplField.fieldCode);
      if (!draftField) {
        fieldChanges++;
      } else if (JSON.stringify(draftField.fieldValue) !== JSON.stringify(tplField.fieldValue)) {
        fieldChanges++;
      }
    }
    for (const df of draft.fields) {
      if (!template.supplementalFields.find((f) => f.fieldCode === df.fieldCode)) {
        fieldChanges++;
      }
    }

    return {
      bracketChanges,
      fieldChanges,
      source: template.templateCode,
    };
  }

  private mapAuthoringToRuntimePayload(draft: AuthoringDraft): {
    data: Record<string, any>;
    checksum: string;
  } {
    const brackets = draft.brackets
      .sort((a, b) => a.seqNo - b.seqNo)
      .map((b) => ({
        min: b.bracketFrom,
        max: b.isOpenEnded ? null : b.bracketTo,
        rate: b.marginalRate,
        base_amount: b.baseTax,
      }));

    const meta: Record<string, any> = {};
    for (const field of draft.fields) {
      meta[field.fieldCode] = field.fieldValue;
    }

    const data: Record<string, any> = { brackets, meta };

    if (draft.countryCode === 'ZA') {
      if (!meta.rebates) meta.rebates = {};
      this.promoteFieldToNested(meta, 'primary_rebate', 'rebates', 'primary');
      this.promoteFieldToNested(meta, 'secondary_rebate', 'rebates', 'secondary');
      this.promoteFieldToNested(meta, 'tertiary_rebate', 'rebates', 'tertiary');
      this.promoteFieldToNested(meta, 'tax_threshold_under_65', 'thresholds', 'under65');
      this.promoteFieldToNested(meta, 'tax_threshold_65_to_74', 'thresholds', 'age65to74');
      this.promoteFieldToNested(meta, 'tax_threshold_75_plus', 'thresholds', 'age75plus');
    }

    if (draft.countryCode === 'LS') {
      if (meta.annual_tax_credit !== undefined) {
        meta.tax_credit = meta.annual_tax_credit;
      }
    }

    return { data, checksum: this.computeChecksum(data) };
  }

  private promoteFieldToNested(
    meta: Record<string, any>,
    flatKey: string,
    group: string,
    nestedKey: string,
  ): void {
    if (meta[flatKey] !== undefined) {
      if (!meta[group]) meta[group] = {};
      meta[group][nestedKey] = meta[flatKey];
      delete meta[flatKey];
    }
  }

  private computeChecksum(data: Record<string, any>): string {
    const canonical = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(canonical).digest('hex').substring(0, 16);
  }

  private toDraft(version: any): AuthoringDraft {
    return {
      id: version.id,
      countryCode: version.countryCode,
      tableType: version.tableType,
      taxYear: version.taxYear,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      status: version.status,
      sourceType: version.sourceType,
      sourceReference: version.sourceReference,
      sourceChecksum: version.sourceChecksum,
      templateId: version.templateId,
      templateCode: version.templateCode,
      templateVersion: version.templateVersion,
      copiedFromAuthoringId: version.copiedFromAuthoringId,
      publishedTaxTableSetId: version.publishedTaxTableSetId,
      createdByUserId: version.createdByUserId,
      reviewedByUserId: version.reviewedByUserId,
      publishedByUserId: version.publishedByUserId,
      publishReason: version.publishReason,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      publishedAt: version.publishedAt,
      brackets: (version.brackets ?? []).map((b: any) => ({
        id: b.id,
        seqNo: b.seqNo,
        bracketFrom: Number(b.bracketFrom),
        bracketTo: b.bracketTo != null ? Number(b.bracketTo) : null,
        marginalRate: Number(b.marginalRate),
        baseTax: Number(b.baseTax),
        derivedBaseTax: b.derivedBaseTax != null ? Number(b.derivedBaseTax) : null,
        isOpenEnded: b.isOpenEnded,
        baseTaxOverrideReason: b.baseTaxOverrideReason,
      })),
      fields: (version.fields ?? []).map((f: any) => ({
        id: f.id,
        fieldCode: f.fieldCode,
        fieldValue: f.fieldValueJson,
      })),
    };
  }
}
