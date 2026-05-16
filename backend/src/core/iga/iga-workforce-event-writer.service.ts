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
    tx?: PrismaTx,
  ): Promise<void> {
    const event = this.eventBuilder.buildExternalPersonCreated({ contractor });
    await this.outbox.save(event, tx);
  }

  async persistExternalPersonUpdated(
    contractor: IgaEventContractorSlice,
    tx?: PrismaTx,
  ): Promise<void> {
    const event = this.eventBuilder.buildExternalPersonUpdated({ contractor });
    await this.outbox.save(event, tx);
  }

  async persistSponsorAssigned(
    contractor: IgaEventContractorSlice,
    engagement: IgaEventEngagementSponsorSlice,
    tx?: PrismaTx,
  ): Promise<void> {
    const event = this.eventBuilder.buildSponsorAssigned({ contractor, engagement });
    await this.outbox.save(event, tx);
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
