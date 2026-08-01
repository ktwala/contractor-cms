import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toIgaEventContractorSlice } from '../../core/iga/iga-event.mapper';
import type { IgaEventEngagementSponsorSlice } from '../../core/iga/iga-event.builder';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from '../contractors/contractor-workforce-domain-events.constants';
import type { ContractorWorkforceDomainEvent } from '../contractors/contractor-workforce-domain-events.constants';
import { AccessIntegrationPublishService } from './access-integration-publish.service';
import {
  isWorkforceAccessRestoreEvent,
  isWorkforceAccessRevokeEvent,
  shouldPublishWorkforceAccessIntent,
} from './workforce-access-intent.constants';

type PrismaTx = Prisma.TransactionClient;

export type ReactToWorkforceDomainEventInput = {
  tx: PrismaTx;
  contractorId: string;
  organizationId: string | null;
  domainEvent: ContractorWorkforceDomainEvent;
};

/**
 * CAP-ACCESS-INTEGRATION §10.1 — consumes authoritative workforce facts;
 * publishes access intent only (no workforce mutation, no IGA execution).
 */
@Injectable()
export class AccessIntegrationWorkforceReactionService {
  constructor(
    private readonly accessIntegrationPublish: AccessIntegrationPublishService,
  ) {}

  async reactToWorkforceDomainEvent(
    input: ReactToWorkforceDomainEventInput,
  ): Promise<void> {
    if (!shouldPublishWorkforceAccessIntent(input.domainEvent)) {
      return;
    }

    const contractor = await input.tx.contractor.findUnique({
      where: { id: input.contractorId },
      select: {
        id: true,
        supplierId: true,
        externalPersonId: true,
        personType: true,
        workerArchetype: true,
        accessIntent: true,
        riskTier: true,
        igaIntegrationStatus: true,
      },
    });

    if (!contractor) {
      return;
    }

    const engagement = await this.resolveEngagementSlice(input.tx, input.contractorId);
    const contractorSlice = toIgaEventContractorSlice(contractor);

    if (isWorkforceAccessRevokeEvent(input.domainEvent)) {
      if (input.domainEvent === CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.SUSPENDED) {
        await this.accessIntegrationPublish.publishWorkforceSuspendedAccessIntent(
          contractorSlice,
          input.organizationId,
          input.tx,
          engagement,
        );
        return;
      }

      await this.accessIntegrationPublish.publishWorkforceTerminatedAccessIntent(
        contractorSlice,
        input.organizationId,
        input.tx,
        engagement,
      );
      return;
    }

    if (isWorkforceAccessRestoreEvent(input.domainEvent)) {
      await this.accessIntegrationPublish.publishWorkforceAccessRestoreIntent(
        contractorSlice,
        input.organizationId,
        input.tx,
        engagement,
      );
    }
  }

  private async resolveEngagementSlice(
    tx: PrismaTx,
    contractorId: string,
  ): Promise<IgaEventEngagementSponsorSlice | null> {
    const engagement = await tx.contractorEngagement.findFirst({
      where: { contractorId, isActive: true },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        responsibleManagerEmployeeId: true,
        responsibleManagerStatus: true,
      },
    });

    if (!engagement) {
      return null;
    }

    return {
      id: engagement.id,
      responsibleManagerEmployeeId: engagement.responsibleManagerEmployeeId,
      responsibleManagerStatus: engagement.responsibleManagerStatus,
    };
  }
}
