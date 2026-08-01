import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  IgaEventContractorSlice,
  IgaEventEngagementSponsorSlice,
} from './iga-event.builder';
import { IgaEventBuilder } from './iga-event.builder';
import { IgaOutboxService } from './iga-outbox.service';

type PrismaTx = Prisma.TransactionClient;

/**
 * PR-IGA-EVENT-WRITE-1 — build + persist outbound events; fails the caller if outbox save fails.
 */
@Injectable()
export class IgaWorkforceEventWriter {
  constructor(
    private readonly eventBuilder: IgaEventBuilder,
    private readonly outbox: IgaOutboxService,
  ) {}

  async persistExternalPersonCreated(
    contractor: IgaEventContractorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
  ): Promise<void> {
    const event = this.eventBuilder.buildExternalPersonCreated({ contractor });
    await this.outbox.save(event, { tx, organizationId });
  }

  async persistExternalPersonUpdated(
    contractor: IgaEventContractorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
    engagement?: IgaEventEngagementSponsorSlice | null,
  ): Promise<void> {
    const event = this.eventBuilder.buildExternalPersonUpdated({
      contractor,
      engagement,
    });
    await this.outbox.save(event, { tx, organizationId });
  }

  async persistExternalPersonSuspended(
    contractor: IgaEventContractorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
    engagement?: IgaEventEngagementSponsorSlice | null,
  ): Promise<void> {
    const event = this.eventBuilder.buildExternalPersonSuspended({
      contractor,
      engagement,
    });
    await this.outbox.save(event, { tx, organizationId });
  }

  async persistExternalPersonTerminated(
    contractor: IgaEventContractorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
    engagement?: IgaEventEngagementSponsorSlice | null,
  ): Promise<void> {
    const event = this.eventBuilder.buildExternalPersonTerminated({
      contractor,
      engagement,
    });
    await this.outbox.save(event, { tx, organizationId });
  }

  async persistSponsorAssigned(
    contractor: IgaEventContractorSlice,
    engagement: IgaEventEngagementSponsorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
  ): Promise<void> {
    const event = this.eventBuilder.buildSponsorAssigned({ contractor, engagement });
    await this.outbox.save(event, { tx, organizationId });
  }
}

/** True when primary sponsor id is newly set or changed (not cleared-only / delegate-only). */
export function shouldEmitSponsorAssignedEvent(
  previousPrimarySponsorId: string | null,
  nextPrimarySponsorId: string | null,
): boolean {
  if (!nextPrimarySponsorId) return false;
  return previousPrimarySponsorId !== nextPrimarySponsorId;
}
