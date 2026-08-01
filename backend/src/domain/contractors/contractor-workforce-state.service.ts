import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  AcquisitionModel,
  Contractor,
  ContractorWorkforceHistorySource,
  ContractorWorkforceState,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  CONTRACTOR_WORKFORCE_TRANSITIONS,
  assertWorkforceTransitionAuthorityNote,
  assertWorkforceTransitionReason,
  buildWorkforceBlacklistHistoryMetadata,
  deriveIsActiveFromWorkforceState,
  resolveWorkforceDomainEvent,
} from './contractor-workforce-state.constants';
import { InvalidContractorWorkforceTransitionException } from './contractor-workforce-state.errors';
import { ContractorWorkforceEventPublisherService } from './contractor-workforce-event-publisher.service';
import { ContractorWorkforceHistoryService } from './contractor-workforce-history.service';
import { AccessIntegrationWorkforceReactionService } from '../access-integration/access-integration-workforce-reaction.service';
import { CONTRACTOR_WORKFORCE_HISTORY_SOURCES } from './contractor-workforce-history.constants';

type PrismaTx = Prisma.TransactionClient;

export type ApplyWorkforceTransitionParams = {
  accessContext: AccessContext;
  contractorId: string;
  targetState: ContractorWorkforceState;
  reason?: string;
  authorityNote?: string;
  source?: ContractorWorkforceHistorySource;
  effectiveAt?: Date;
  tx?: PrismaTx;
};

@Injectable()
export class ContractorWorkforceStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventPublisher: ContractorWorkforceEventPublisherService,
    private readonly workforceHistory: ContractorWorkforceHistoryService,
    private readonly accessIntegrationWorkforceReaction: AccessIntegrationWorkforceReactionService,
  ) {}

  assertTransitionAllowed(
    currentState: ContractorWorkforceState,
    targetState: ContractorWorkforceState,
  ): void {
    if (currentState === targetState) {
      throw new InvalidContractorWorkforceTransitionException(
        currentState,
        targetState,
        'Contractor is already in the requested workforce state',
      );
    }

    const allowed = CONTRACTOR_WORKFORCE_TRANSITIONS[currentState] ?? [];
    if (!allowed.includes(targetState)) {
      throw new InvalidContractorWorkforceTransitionException(
        currentState,
        targetState,
      );
    }
  }

  async applyTransition(
    params: ApplyWorkforceTransitionParams,
  ): Promise<Contractor> {
    const run = async (tx: PrismaTx) => {
      const existing = await tx.contractor.findUnique({
        where: { id: params.contractorId },
      });

      if (!existing) {
        throw new NotFoundException('Contractor not found');
      }

      this.assertTransitionAllowed(existing.workforceState, params.targetState);
      assertWorkforceTransitionReason(
        existing.workforceState,
        params.targetState,
        params.reason,
      );
      assertWorkforceTransitionAuthorityNote(
        existing.workforceState,
        params.targetState,
        params.authorityNote,
      );
      await this.assertIndependentPrimaryResponsibleManagerBeforeActivate(
        tx,
        existing,
        params.targetState,
      );

      const historyMetadata =
        params.targetState === ContractorWorkforceState.BLACKLISTED &&
        params.authorityNote?.trim()
          ? buildWorkforceBlacklistHistoryMetadata(params.authorityNote)
          : undefined;

      const updated = await tx.contractor.update({
        where: { id: params.contractorId },
        data: {
          workforceState: params.targetState,
          isActive: deriveIsActiveFromWorkforceState(params.targetState),
        },
      });

      const organizationId = await this.resolveOrganizationId(
        tx,
        existing,
        params.accessContext.targetOrganizationId,
      );

      await this.workforceHistory.recordTransition({
        tx,
        contractorId: updated.id,
        organizationId,
        fromState: existing.workforceState,
        toState: params.targetState,
        actorUserId: params.accessContext.actorUserId,
        reason: params.reason,
        source: params.source ?? CONTRACTOR_WORKFORCE_HISTORY_SOURCES.OPS,
        effectiveAt: params.effectiveAt,
        metadata: historyMetadata,
      });

      await this.auditService.logAction(
        params.accessContext.actorUserId,
        'CONTRACTOR_WORKFORCE_STATE_CHANGED',
        'Contractor',
        updated.id,
        { workforceState: existing.workforceState, isActive: existing.isActive },
        { workforceState: updated.workforceState, isActive: updated.isActive },
        {
          organizationId,
          metadata: {
            reason: params.reason ?? null,
            authorityNote:
              params.targetState === ContractorWorkforceState.BLACKLISTED
                ? params.authorityNote?.trim() ?? null
                : null,
          },
        },
      );

      const domainEvent = resolveWorkforceDomainEvent(
        existing.workforceState,
        params.targetState,
      );
      if (domainEvent) {
        await this.eventPublisher.publishStub({
          contractorId: updated.id,
          organizationId,
          actorUserId: params.accessContext.actorUserId,
          fromState: existing.workforceState,
          toState: params.targetState,
          domainEvent,
          reason: params.reason,
        });

        await this.accessIntegrationWorkforceReaction.reactToWorkforceDomainEvent({
          tx,
          contractorId: updated.id,
          organizationId,
          domainEvent,
        });
      }

      return updated;
    };

    if (params.tx) {
      return run(params.tx);
    }

    return this.prisma.$transaction(run);
  }

  /** Legacy bridge: map boolean deactivate/activate to workforce transitions. */
  async applyLegacyIsActiveChange(
    accessContext: AccessContext,
    contractor: Pick<Contractor, 'id' | 'workforceState' | 'isActive'>,
    nextIsActive: boolean,
    reason?: string,
    tx?: PrismaTx,
  ): Promise<Contractor | null> {
    if (contractor.isActive === nextIsActive) {
      return null;
    }

    const targetState = nextIsActive
      ? ContractorWorkforceState.ACTIVE
      : ContractorWorkforceState.TERMINATED;

    return this.applyTransition({
      accessContext,
      contractorId: contractor.id,
      targetState,
      reason: reason ?? (nextIsActive ? 'legacy_isActive_true' : 'legacy_isActive_false'),
      source: CONTRACTOR_WORKFORCE_HISTORY_SOURCES.LEGACY_BRIDGE,
      tx,
    });
  }

  private async assertIndependentPrimaryResponsibleManagerBeforeActivate(
    tx: PrismaTx,
    contractor: Contractor,
    targetState: ContractorWorkforceState,
  ): Promise<void> {
    if (contractor.acquisitionModel !== AcquisitionModel.INDEPENDENT) {
      return;
    }
    if (targetState !== ContractorWorkforceState.ACTIVE) {
      return;
    }

    const sponsored = await tx.contractorEngagement.findFirst({
      where: {
        contractorId: contractor.id,
        responsibleManagerEmployeeId: { not: null },
      },
    });

    if (!sponsored) {
      throw new BadRequestException(
        'Independent external workers require a primary sponsor before activation',
      );
    }
  }

  private async resolveOrganizationId(
    tx: PrismaTx,
    contractor: Pick<Contractor, 'organizationId' | 'supplierId'>,
    contextOrgId: string | null | undefined,
  ): Promise<string | null> {
    if (contextOrgId) {
      return contextOrgId;
    }
    if (contractor.organizationId) {
      return contractor.organizationId;
    }
    if (!contractor.supplierId) {
      return null;
    }
    const supplier = await tx.supplier.findUnique({
      where: { id: contractor.supplierId },
      select: { organizationId: true },
    });
    return supplier?.organizationId ?? null;
  }
}
