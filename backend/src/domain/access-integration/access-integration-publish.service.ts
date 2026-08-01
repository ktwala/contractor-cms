import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  IgaEventContractorSlice,
  IgaEventEngagementSponsorSlice,
} from '../../core/iga/iga-event.builder';
import { IgaOutboxService } from '../../core/iga/iga-outbox.service';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';
import {
  buildContractorMigratedIntentEvent,
  ContractorMigratedIgaEventV1,
} from './types/acquisition-migrated-intent.types';

type PrismaTx = Prisma.TransactionClient;

export type PublishAcquisitionMigratedIntentInput = Omit<
  ContractorMigratedIgaEventV1,
  'version' | 'source' | 'eventId' | 'eventType' | 'occurredAt'
> & {
  organizationId: string;
  tx?: PrismaTx;
};

/**
 * CAP-ACCESS-INTEGRATION v1.0 — gateway publish boundary.
 * All IGA outbox enqueue operations SHALL route through this service.
 */
@Injectable()
export class AccessIntegrationPublishService {
  constructor(
    private readonly workforceEventWriter: IgaWorkforceEventWriter,
    private readonly outbox: IgaOutboxService,
  ) {}

  /** CAP §6 Queue Publish — workforce person created intent. */
  async publishExternalPersonCreated(
    contractor: IgaEventContractorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
  ): Promise<void> {
    await this.workforceEventWriter.persistExternalPersonCreated(
      contractor,
      organizationId,
      tx,
    );
  }

  /** CAP §6 Queue Publish — workforce person updated intent. */
  async publishExternalPersonUpdated(
    contractor: IgaEventContractorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
  ): Promise<void> {
    await this.workforceEventWriter.persistExternalPersonUpdated(
      contractor,
      organizationId,
      tx,
    );
  }

  /** CAP §6 Queue Publish — sponsor assignment intent. */
  async publishSponsorAssigned(
    contractor: IgaEventContractorSlice,
    engagement: IgaEventEngagementSponsorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
  ): Promise<void> {
    await this.workforceEventWriter.persistSponsorAssigned(
      contractor,
      engagement,
      organizationId,
      tx,
    );
  }

  /**
   * CAP §6 Publish to IGA — Identity Acquisition handoff (`contractor.migrated`).
   * Responsibility ends when outbox accepts the intent; IGA owns execution truth.
   */
  async publishAcquisitionMigratedIntent(
    input: PublishAcquisitionMigratedIntentInput,
  ): Promise<void> {
    const { organizationId, tx, ...eventFields } = input;
    const event = buildContractorMigratedIntentEvent(eventFields);
    await this.outbox.save(
      event as unknown as Parameters<IgaOutboxService['save']>[0],
      { tx, organizationId },
    );
  }

  /** CAP §10.1 — Worker Suspended → access revoke intent (IGA executes). */
  async publishWorkforceSuspendedAccessIntent(
    contractor: IgaEventContractorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
    engagement?: IgaEventEngagementSponsorSlice | null,
  ): Promise<void> {
    await this.workforceEventWriter.persistExternalPersonSuspended(
      contractor,
      organizationId,
      tx,
      engagement,
    );
  }

  /** CAP §10.1 — Worker Terminated / Blacklisted → access revoke intent. */
  async publishWorkforceTerminatedAccessIntent(
    contractor: IgaEventContractorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
    engagement?: IgaEventEngagementSponsorSlice | null,
  ): Promise<void> {
    await this.workforceEventWriter.persistExternalPersonTerminated(
      contractor,
      organizationId,
      tx,
      engagement,
    );
  }

  /** CAP §10.1 — Worker Activated / Reinstated / Rehired → access restore intent. */
  async publishWorkforceAccessRestoreIntent(
    contractor: IgaEventContractorSlice,
    organizationId: string | null,
    tx?: PrismaTx,
    engagement?: IgaEventEngagementSponsorSlice | null,
  ): Promise<void> {
    await this.workforceEventWriter.persistExternalPersonUpdated(
      contractor,
      organizationId,
      tx,
      engagement,
    );
  }
}
