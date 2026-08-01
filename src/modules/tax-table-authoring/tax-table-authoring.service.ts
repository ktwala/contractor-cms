import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TaxTableTemplateRegistry } from './tax-table-template.registry';
import {
  AuthoringDraft,
  AuthoringBracketInput,
  AuthoringFieldInput,
  TaxTableAuthoringStatus,
} from './types/authoring.types';
import { TTA_ERROR_CODES, TtaException } from './types/error-codes';

@Injectable()
export class TaxTableAuthoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateRegistry: TaxTableTemplateRegistry,
  ) {}

  async createFromTemplate(input: {
    templateId: string;
    countryCode: string;
    tableType: string;
    taxYear: string;
    effectiveFrom: string;
    effectiveTo?: string;
    actorUserId: string;
  }): Promise<AuthoringDraft> {
    const template = this.templateRegistry.getById(input.templateId);
    if (!template) {
      throw new TtaException(TTA_ERROR_CODES.NOT_FOUND, `Template ${input.templateId} not found`, { templateId: input.templateId }, 404);
    }

    const effectiveFrom = input.effectiveFrom ?? template.defaultEffectiveFrom;

    const version = await this.prisma.taxTableAuthoringVersion.create({
      data: {
        countryCode: input.countryCode,
        tableType: input.tableType,
        taxYear: input.taxYear,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        status: 'DRAFT',
        sourceType: 'TEMPLATE',
        sourceReference: template.sourceReference,
        sourceChecksum: template.sourceChecksum,
        templateId: template.templateId,
        templateCode: template.templateCode,
        templateVersion: template.version,
        createdByUserId: input.actorUserId,
        brackets: {
          create: template.brackets.map((b) => ({
            seqNo: b.seqNo,
            bracketFrom: b.bracketFrom,
            bracketTo: b.bracketTo,
            marginalRate: b.marginalRate,
            baseTax: b.baseTax,
            isOpenEnded: b.isOpenEnded,
          })),
        },
        fields: {
          create: template.supplementalFields.map((f) => ({
            fieldCode: f.fieldCode,
            fieldValueJson: f.fieldValue as any,
          })),
        },
        auditEvents: {
          create: {
            eventType: 'template_loaded',
            actorUserId: input.actorUserId,
            payloadJson: {
              templateId: template.templateId,
              templateCode: template.templateCode,
              templateVersion: template.version,
            },
          },
        },
      },
      include: { brackets: true, fields: true },
    });

    return this.toDraft(version);
  }

  async createFromCopy(input: {
    sourceAuthoringId: string;
    taxYear: string;
    effectiveFrom: string;
    effectiveTo?: string;
    actorUserId: string;
  }): Promise<AuthoringDraft> {
    const source = await this.prisma.taxTableAuthoringVersion.findUnique({
      where: { id: input.sourceAuthoringId },
      include: { brackets: true, fields: true },
    });

    if (!source) {
      throw new TtaException(TTA_ERROR_CODES.NOT_FOUND, `Authoring version ${input.sourceAuthoringId} not found`, { sourceAuthoringId: input.sourceAuthoringId }, 404);
    }

    const version = await this.prisma.taxTableAuthoringVersion.create({
      data: {
        countryCode: source.countryCode,
        tableType: source.tableType,
        taxYear: input.taxYear,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        status: 'DRAFT',
        sourceType: 'COPY',
        sourceReference: source.sourceReference,
        copiedFromAuthoringId: source.id,
        createdByUserId: input.actorUserId,
        brackets: {
          create: source.brackets.map((b) => ({
            seqNo: b.seqNo,
            bracketFrom: b.bracketFrom,
            bracketTo: b.bracketTo,
            marginalRate: b.marginalRate,
            baseTax: b.baseTax,
            derivedBaseTax: b.derivedBaseTax,
            isOpenEnded: b.isOpenEnded,
            baseTaxOverrideReason: b.baseTaxOverrideReason,
          })),
        },
        fields: {
          create: source.fields.map((f) => ({
            fieldCode: f.fieldCode,
            fieldValueJson: (f.fieldValueJson ?? {}) as any,
          })),
        },
        auditEvents: {
          create: {
            eventType: 'created_from_copy',
            actorUserId: input.actorUserId,
            payloadJson: { sourceAuthoringId: source.id },
          },
        },
      },
      include: { brackets: true, fields: true },
    });

    return this.toDraft(version);
  }

  async createManual(input: {
    countryCode: string;
    tableType: string;
    taxYear: string;
    effectiveFrom: string;
    effectiveTo?: string;
    brackets: AuthoringBracketInput[];
    fields?: AuthoringFieldInput[];
    actorUserId: string;
  }): Promise<AuthoringDraft> {
    const version = await this.prisma.taxTableAuthoringVersion.create({
      data: {
        countryCode: input.countryCode,
        tableType: input.tableType,
        taxYear: input.taxYear,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        status: 'DRAFT',
        sourceType: 'MANUAL',
        createdByUserId: input.actorUserId,
        brackets: {
          create: input.brackets.map((b) => ({
            seqNo: b.seqNo,
            bracketFrom: b.bracketFrom,
            bracketTo: b.bracketTo,
            marginalRate: b.marginalRate,
            baseTax: b.baseTax,
            isOpenEnded: b.isOpenEnded,
            baseTaxOverrideReason: b.baseTaxOverrideReason,
          })),
        },
        fields: {
          create: (input.fields ?? []).map((f) => ({
            fieldCode: f.fieldCode,
            fieldValueJson: f.fieldValue as any,
          })),
        },
        auditEvents: {
          create: {
            eventType: 'created_manual',
            actorUserId: input.actorUserId,
            payloadJson: {},
          },
        },
      },
      include: { brackets: true, fields: true },
    });

    return this.toDraft(version);
  }

  async createFromImport(input: {
    countryCode: string;
    tableType: string;
    taxYear: string;
    effectiveFrom: string;
    effectiveTo?: string;
    sourceReference?: string;
    brackets: AuthoringBracketInput[];
    fields?: AuthoringFieldInput[];
    actorUserId: string;
  }): Promise<AuthoringDraft> {
    const version = await this.prisma.taxTableAuthoringVersion.create({
      data: {
        countryCode: input.countryCode,
        tableType: input.tableType,
        taxYear: input.taxYear,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        status: 'DRAFT',
        sourceType: 'IMPORT',
        sourceReference: input.sourceReference ?? null,
        createdByUserId: input.actorUserId,
        brackets: {
          create: input.brackets.map((b) => ({
            seqNo: b.seqNo,
            bracketFrom: b.bracketFrom,
            bracketTo: b.bracketTo,
            marginalRate: b.marginalRate,
            baseTax: b.baseTax,
            isOpenEnded: b.isOpenEnded,
            baseTaxOverrideReason: b.baseTaxOverrideReason,
          })),
        },
        fields: {
          create: (input.fields ?? []).map((f) => ({
            fieldCode: f.fieldCode,
            fieldValueJson: f.fieldValue as any,
          })),
        },
        auditEvents: {
          create: {
            eventType: 'created_from_import',
            actorUserId: input.actorUserId,
            payloadJson: { sourceReference: input.sourceReference ?? null },
          },
        },
      },
      include: { brackets: true, fields: true },
    });

    return this.toDraft(version);
  }

  async updateBrackets(
    authoringVersionId: string,
    brackets: AuthoringBracketInput[],
    actorUserId: string,
  ): Promise<AuthoringDraft> {
    const version = await this.loadAndAssertEditable(authoringVersionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.taxTableAuthoringBracket.deleteMany({
        where: { authoringVersionId },
      });

      await tx.taxTableAuthoringBracket.createMany({
        data: brackets.map((b) => ({
          authoringVersionId,
          seqNo: b.seqNo,
          bracketFrom: b.bracketFrom,
          bracketTo: b.bracketTo,
          marginalRate: b.marginalRate,
          baseTax: b.baseTax,
          isOpenEnded: b.isOpenEnded,
          baseTaxOverrideReason: b.baseTaxOverrideReason,
        })),
      });

      await tx.taxTableAuthoringAuditEvent.create({
        data: {
          authoringVersionId,
          eventType: 'brackets_updated',
          actorUserId,
          payloadJson: { bracketCount: brackets.length },
        },
      });
    });

    return this.getById(authoringVersionId);
  }

  async updateFields(
    authoringVersionId: string,
    fields: AuthoringFieldInput[],
    actorUserId: string,
  ): Promise<AuthoringDraft> {
    await this.loadAndAssertEditable(authoringVersionId);

    await this.prisma.$transaction(async (tx) => {
      for (const field of fields) {
        await tx.taxTableAuthoringField.upsert({
          where: {
            id: await this.findFieldId(tx, authoringVersionId, field.fieldCode),
          },
          create: {
            authoringVersionId,
            fieldCode: field.fieldCode,
            fieldValueJson: field.fieldValue as any,
          },
          update: {
            fieldValueJson: field.fieldValue as any,
          },
        });
      }

      await tx.taxTableAuthoringAuditEvent.create({
        data: {
          authoringVersionId,
          eventType: 'fields_updated',
          actorUserId,
          payloadJson: { fieldCodes: fields.map((f) => f.fieldCode) },
        },
      });
    });

    return this.getById(authoringVersionId);
  }

  async submitForApproval(
    authoringVersionId: string,
    actorUserId: string,
    comment?: string,
  ): Promise<AuthoringDraft> {
    const version = await this.loadAndAssertEditable(authoringVersionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.taxTableAuthoringVersion.update({
        where: { id: authoringVersionId },
        data: { status: 'PENDING_APPROVAL' },
      });

      await tx.taxTableAuthoringAuditEvent.create({
        data: {
          authoringVersionId,
          eventType: 'submitted_for_approval',
          actorUserId,
          payloadJson: { comment: comment ?? null },
        },
      });
    });

    return this.getById(authoringVersionId);
  }

  async approve(
    authoringVersionId: string,
    actorUserId: string,
    comment?: string,
    options?: { disallowSelfApproval?: boolean },
  ): Promise<AuthoringDraft> {
    const version = await this.prisma.taxTableAuthoringVersion.findUnique({
      where: { id: authoringVersionId },
    });
    if (!version) {
      throw new TtaException(TTA_ERROR_CODES.NOT_FOUND, 'Authoring version not found', { authoringVersionId }, 404);
    }
    if (version.status !== 'PENDING_APPROVAL') {
      throw new TtaException(TTA_ERROR_CODES.INVALID_STATUS, 'Only PENDING_APPROVAL versions can be approved', { status: version.status });
    }

    if (options?.disallowSelfApproval && version.createdByUserId === actorUserId) {
      throw new TtaException(
        TTA_ERROR_CODES.SELF_APPROVAL_BLOCKED,
        'You cannot approve your own draft when segregation-of-duties policy is enabled',
        { createdByUserId: version.createdByUserId, actorUserId },
        403,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.taxTableAuthoringVersion.update({
        where: { id: authoringVersionId },
        data: {
          status: 'APPROVED',
          reviewedByUserId: actorUserId,
        },
      });

      await tx.taxTableAuthoringAuditEvent.create({
        data: {
          authoringVersionId,
          eventType: 'approved',
          actorUserId,
          payloadJson: {
            comment: comment ?? null,
            selfApprovalBlocked: options?.disallowSelfApproval ?? false,
          },
        },
      });
    });

    return this.getById(authoringVersionId);
  }

  async archive(
    authoringVersionId: string,
    actorUserId: string,
  ): Promise<AuthoringDraft> {
    const version = await this.prisma.taxTableAuthoringVersion.findUnique({
      where: { id: authoringVersionId },
    });
    if (!version) {
      throw new TtaException(TTA_ERROR_CODES.NOT_FOUND, 'Authoring version not found', { authoringVersionId }, 404);
    }
    if (version.status === 'PUBLISHED') {
      throw new TtaException(TTA_ERROR_CODES.INVALID_STATUS, 'Cannot archive a PUBLISHED version', { status: version.status });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.taxTableAuthoringVersion.update({
        where: { id: authoringVersionId },
        data: { status: 'ARCHIVED' },
      });

      await tx.taxTableAuthoringAuditEvent.create({
        data: {
          authoringVersionId,
          eventType: 'archived',
          actorUserId,
          payloadJson: {},
        },
      });
    });

    return this.getById(authoringVersionId);
  }

  async getById(id: string): Promise<AuthoringDraft> {
    const version = await this.prisma.taxTableAuthoringVersion.findUnique({
      where: { id },
      include: {
        brackets: { orderBy: { seqNo: 'asc' } },
        fields: true,
      },
    });
    if (!version) throw new TtaException(TTA_ERROR_CODES.NOT_FOUND, 'Authoring version not found', { id }, 404);
    return this.toDraft(version);
  }

  async list(filters?: {
    countryCode?: string;
    tableType?: string;
    taxYear?: string;
    status?: TaxTableAuthoringStatus;
  }): Promise<AuthoringDraft[]> {
    const where: any = {};
    if (filters?.countryCode) where.countryCode = filters.countryCode;
    if (filters?.tableType) where.tableType = filters.tableType;
    if (filters?.taxYear) where.taxYear = filters.taxYear;
    if (filters?.status) where.status = filters.status;

    const versions = await this.prisma.taxTableAuthoringVersion.findMany({
      where,
      include: {
        brackets: { orderBy: { seqNo: 'asc' } },
        fields: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return versions.map((v) => this.toDraft(v));
  }

  async getAuditTrail(authoringVersionId: string) {
    return this.prisma.taxTableAuthoringAuditEvent.findMany({
      where: { authoringVersionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async loadAndAssertEditable(id: string) {
    const version = await this.prisma.taxTableAuthoringVersion.findUnique({
      where: { id },
    });
    if (!version) throw new TtaException(TTA_ERROR_CODES.NOT_FOUND, 'Authoring version not found', { id }, 404);
    if (version.status !== 'DRAFT') {
      throw new TtaException(TTA_ERROR_CODES.INVALID_STATUS, `Cannot edit a version in ${version.status} status`, { status: version.status });
    }
    return version;
  }

  private async findFieldId(tx: any, authoringVersionId: string, fieldCode: string): Promise<string> {
    const existing = await tx.taxTableAuthoringField.findFirst({
      where: { authoringVersionId, fieldCode },
      select: { id: true },
    });
    return existing?.id ?? 'non-existent-id-forces-create';
  }

  private toDraft(version: any): AuthoringDraft {
    return {
      id: version.id,
      countryCode: version.countryCode,
      tableType: version.tableType,
      taxYear: version.taxYear,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      status: version.status as TaxTableAuthoringStatus,
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
