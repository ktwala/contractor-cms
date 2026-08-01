import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateReturnInput {
  countryCode: string;
  legalEntityId: string;
  payGroupId?: string;
  returnCode: string;
  returnLabel: string;
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  status: string;
  totalDue: number;
  employeeCount: number;
  sourcePayrunIds: string[];
  displaySchemaKey?: string;
  statutoryProfileKey: string;
  countryPackVersion?: string;
  generatedAt: Date;
  generatedByUserId?: string;
  amendsReturnId?: string;
  versionNumber?: number;
  filingDueDate?: Date;
  filingAuthority?: string;
  metadata?: Record<string, unknown>;
  items: CreateReturnItemInput[];
}

export interface CreateReturnItemInput {
  itemCode: string;
  itemLabel: string;
  amount: number;
  currency: string;
  sourceLineCodes: string[];
  employeeCount?: number;
  sortOrder: number;
  metadata?: Record<string, unknown>;
}

export interface ListReturnsFilters {
  countryCode?: string;
  legalEntityId?: string;
  periodKey?: string;
  returnCode?: string;
  status?: string;
}

@Injectable()
export class StatutoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createReturnWithItems(input: CreateReturnInput) {
    return this.prisma.$transaction(async (tx) => {
      const ret = await tx.statutoryReturn.create({
        data: {
          countryCode: input.countryCode,
          legalEntityId: input.legalEntityId,
          payGroupId: input.payGroupId,
          returnCode: input.returnCode,
          returnLabel: input.returnLabel,
          periodKey: input.periodKey,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          currency: input.currency,
          status: input.status,
          totalDue: input.totalDue,
          employeeCount: input.employeeCount,
          sourcePayrunIds: input.sourcePayrunIds,
          displaySchemaKey: input.displaySchemaKey,
          statutoryProfileKey: input.statutoryProfileKey,
          countryPackVersion: input.countryPackVersion,
          generatedAt: input.generatedAt,
          generatedByUserId: input.generatedByUserId,
          amendsReturnId: input.amendsReturnId,
          versionNumber: input.versionNumber ?? 1,
          filingDueDate: input.filingDueDate,
          filingAuthority: input.filingAuthority,
          metadata: input.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
          items: {
            create: input.items.map((item) => ({
              itemCode: item.itemCode,
              itemLabel: item.itemLabel,
              amount: item.amount,
              currency: item.currency,
              sourceLineCodes: item.sourceLineCodes,
              employeeCount: item.employeeCount,
              sortOrder: item.sortOrder,
              metadata: item.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
            })),
          },
        },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
        },
      });

      await tx.statutoryWorkflowEvent.create({
        data: {
          statutoryReturnId: ret.id,
          eventType: 'GENERATED',
          fromStatus: null,
          toStatus: 'draft',
          performedByUserId: input.generatedByUserId,
          performedAt: input.generatedAt,
        },
      });

      return ret;
    });
  }

  async createEvidenceBundle(data: {
    statutoryReturnId: string;
    countryCode: string;
    returnCode: string;
    periodKey: string;
    legalEntityId: string;
    artifacts: unknown[];
    createdByUserId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const bundle = await this.prisma.statutoryEvidenceBundle.create({
      data: {
        statutoryReturnId: data.statutoryReturnId,
        countryCode: data.countryCode,
        returnCode: data.returnCode,
        periodKey: data.periodKey,
        legalEntityId: data.legalEntityId,
        artifacts: data.artifacts as Prisma.InputJsonValue,
        createdByUserId: data.createdByUserId,
        metadata: data.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });

    await this.prisma.statutoryReturn.update({
      where: { id: data.statutoryReturnId },
      data: { evidenceBundleId: bundle.id },
    });

    return bundle;
  }

  async createWorkflowEvent(data: {
    statutoryReturnId: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string;
    performedByUserId?: string;
    comment?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.statutoryWorkflowEvent.create({
      data: {
        statutoryReturnId: data.statutoryReturnId,
        eventType: data.eventType,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        performedByUserId: data.performedByUserId,
        comment: data.comment,
        metadata: data.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });
  }

  async listReturns(filters: ListReturnsFilters) {
    const where: Prisma.StatutoryReturnWhereInput = {};
    if (filters.countryCode) where.countryCode = filters.countryCode;
    if (filters.legalEntityId) where.legalEntityId = filters.legalEntityId;
    if (filters.periodKey) where.periodKey = filters.periodKey;
    if (filters.returnCode) where.returnCode = filters.returnCode;
    if (filters.status) where.status = filters.status;

    return this.prisma.statutoryReturn.findMany({
      where,
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        amendedBy: { select: { id: true } },
      },
      orderBy: [{ periodKey: 'desc' }, { returnCode: 'asc' }],
    });
  }

  async getReturnById(returnId: string) {
    return this.prisma.statutoryReturn.findUnique({
      where: { id: returnId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        workflowEvents: { orderBy: { performedAt: 'asc' } },
        evidenceBundle: true,
        amendedBy: { select: { id: true } },
      },
    });
  }

  async getAllReturnsForDashboard() {
    return this.prisma.statutoryReturn.findMany({
      where: { status: { notIn: ['cancelled'] } },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ periodKey: 'desc' }, { returnCode: 'asc' }],
    });
  }

  async getLatestVersionNumber(countryCode: string, returnCode: string, periodKey: string): Promise<number> {
    const latest = await this.prisma.statutoryReturn.findFirst({
      where: { countryCode, returnCode, periodKey },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return latest?.versionNumber ?? 0;
  }

  async updateReturnStatus(
    returnId: string,
    status: string,
    timestampField: string,
    userId?: string,
    extra?: Record<string, unknown>,
  ) {
    const data: any = { status, [timestampField]: new Date() };
    if (userId) data[timestampField.replace('At', 'ByUserId')] = userId;
    if (extra) Object.assign(data, extra);

    return this.prisma.statutoryReturn.update({
      where: { id: returnId },
      data,
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        workflowEvents: { orderBy: { performedAt: 'asc' } },
      },
    });
  }

  async getEvidenceBundle(returnId: string) {
    return this.prisma.statutoryEvidenceBundle.findUnique({
      where: { statutoryReturnId: returnId },
    });
  }
}
