import { Injectable } from '@nestjs/common';
import {
  ContractorWorkforceHistorySource,
  ContractorWorkforceState,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { deriveWorkforceTransitionLabel } from './contractor-workforce-history.constants';

type PrismaTx = Prisma.TransactionClient;

export type RecordWorkforceHistoryParams = {
  contractorId: string;
  organizationId?: string | null;
  fromState: ContractorWorkforceState | null;
  toState: ContractorWorkforceState;
  actorUserId?: string | null;
  reason?: string | null;
  source: ContractorWorkforceHistorySource;
  effectiveAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
  tx?: PrismaTx;
};

export type WorkforceHistoryEntry = {
  id: string;
  contractorId: string;
  organizationId: string | null;
  fromState: ContractorWorkforceState | null;
  toState: ContractorWorkforceState;
  transitionLabel: string;
  occurredAt: Date;
  effectiveAt: Date | null;
  actorUserId: string | null;
  reason: string | null;
  source: ContractorWorkforceHistorySource;
  metadata: Record<string, unknown> | null;
};

@Injectable()
export class ContractorWorkforceHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordTransition(params: RecordWorkforceHistoryParams): Promise<WorkforceHistoryEntry> {
    const write = async (tx: PrismaTx) => {
      const row = await tx.contractorWorkforceHistory.create({
        data: {
          contractorId: params.contractorId,
          organizationId: params.organizationId ?? null,
          fromState: params.fromState,
          toState: params.toState,
          occurredAt: params.occurredAt ?? new Date(),
          effectiveAt: params.effectiveAt ?? null,
          actorUserId: params.actorUserId ?? null,
          reason: params.reason ?? null,
          source: params.source,
          metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      return this.present(row);
    };

    if (params.tx) {
      return write(params.tx);
    }

    return this.prisma.$transaction(write);
  }

  async listForContractor(contractorId: string): Promise<WorkforceHistoryEntry[]> {
    const rows = await this.prisma.contractorWorkforceHistory.findMany({
      where: { contractorId },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((row) => this.present(row));
  }

  private present(row: {
    id: string;
    contractorId: string;
    organizationId: string | null;
    fromState: ContractorWorkforceState | null;
    toState: ContractorWorkforceState;
    occurredAt: Date;
    effectiveAt: Date | null;
    actorUserId: string | null;
    reason: string | null;
    source: ContractorWorkforceHistorySource;
    metadata: Prisma.JsonValue;
  }): WorkforceHistoryEntry {
    return {
      id: row.id,
      contractorId: row.contractorId,
      organizationId: row.organizationId,
      fromState: row.fromState,
      toState: row.toState,
      transitionLabel: deriveWorkforceTransitionLabel(row.fromState, row.toState),
      occurredAt: row.occurredAt,
      effectiveAt: row.effectiveAt,
      actorUserId: row.actorUserId,
      reason: row.reason,
      source: row.source,
      metadata:
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
    };
  }
}
