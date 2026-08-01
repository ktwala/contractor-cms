import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ContractorAccessIntent,
  ContractorPersonType,
  GovernanceRiskTier,
  IgaIntegrationPlaneStatus,
  ResponsibleManagerAccountabilityStatus,
  WorkerArchetypeKind,
} from '@prisma/client';
import {
  IGA_EVENT_CONTRACT_VERSION,
  IGA_EVENT_SOURCE,
  IgaEventType,
  type IgaOutboundExternalWorkforceEventV1,
} from './iga-event.types';

/** Minimal contractor row slice used to build IGA-facing events (substrate-aligned). */
export interface IgaEventContractorSlice {
  id: string;
  supplierId: string | null;
  externalPersonId: string | null;
  personType: ContractorPersonType | null;
  workerArchetype: WorkerArchetypeKind | null;
  accessIntent: ContractorAccessIntent | null;
  riskTier: GovernanceRiskTier | null;
  igaIntegrationStatus: IgaIntegrationPlaneStatus;
}

export interface IgaEventEngagementSponsorSlice {
  id: string;
  responsibleManagerEmployeeId: string | null;
  responsibleManagerStatus: ResponsibleManagerAccountabilityStatus | null;
}

export interface BuildExternalPersonLifecycleEventInput {
  contractor: IgaEventContractorSlice;
  /** When absent, `engagementId` and sponsor fields are null on the envelope. */
  engagement?: IgaEventEngagementSponsorSlice | null;
}

export interface BuildSponsorAssignedEventInput {
  contractor: IgaEventContractorSlice;
  engagement: IgaEventEngagementSponsorSlice;
}

@Injectable()
export class IgaEventBuilder {
  private newEventId(): string {
    return crypto.randomUUID();
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private serializeEnum<T extends string | null | undefined>(v: T): string | null {
    if (v === undefined || v === null) return null;
    return String(v);
  }

  private buildPayload(
    eventType: IgaEventType,
    contractor: IgaEventContractorSlice,
    engagement: IgaEventEngagementSponsorSlice | null | undefined,
  ): Omit<IgaOutboundExternalWorkforceEventV1, 'version' | 'source'> {
    const eng = engagement ?? null;
    return {
      eventId: this.newEventId(),
      eventType,
      occurredAt: this.nowIso(),
      externalPersonId: contractor.externalPersonId,
      contractorId: contractor.id,
      engagementId: eng?.id ?? null,
      personType: this.serializeEnum(contractor.personType),
      workerArchetype: this.serializeEnum(contractor.workerArchetype),
      supplierId: contractor.supplierId,
      responsibleManagerEmployeeId: eng?.responsibleManagerEmployeeId ?? null,
      responsibleManagerStatus: this.serializeEnum(eng?.responsibleManagerStatus),
      accessIntent: this.serializeEnum(contractor.accessIntent),
      riskTier: this.serializeEnum(contractor.riskTier),
      igaIntegrationStatus: String(contractor.igaIntegrationStatus),
    };
  }

  /**
   * `EXTERNAL_PERSON_CREATED` — sponsor fields optional (null engagement or null sponsor on engagement).
   */
  buildExternalPersonCreated(
    input: BuildExternalPersonLifecycleEventInput,
  ): IgaOutboundExternalWorkforceEventV1 {
    const body = this.buildPayload(
      IgaEventType.EXTERNAL_PERSON_CREATED,
      input.contractor,
      input.engagement,
    );
    return {
      version: IGA_EVENT_CONTRACT_VERSION,
      source: IGA_EVENT_SOURCE,
      ...body,
    };
  }

  /**
   * `EXTERNAL_PERSON_UPDATED` — same payload shape as created; semantically a delta notification at the bus layer.
   */
  buildExternalPersonUpdated(
    input: BuildExternalPersonLifecycleEventInput,
  ): IgaOutboundExternalWorkforceEventV1 {
    const body = this.buildPayload(
      IgaEventType.EXTERNAL_PERSON_UPDATED,
      input.contractor,
      input.engagement,
    );
    return {
      version: IGA_EVENT_CONTRACT_VERSION,
      source: IGA_EVENT_SOURCE,
      ...body,
    };
  }

  buildExternalPersonSuspended(
    input: BuildExternalPersonLifecycleEventInput,
  ): IgaOutboundExternalWorkforceEventV1 {
    const body = this.buildPayload(
      IgaEventType.EXTERNAL_PERSON_SUSPENDED,
      input.contractor,
      input.engagement,
    );
    return {
      version: IGA_EVENT_CONTRACT_VERSION,
      source: IGA_EVENT_SOURCE,
      ...body,
    };
  }

  buildExternalPersonTerminated(
    input: BuildExternalPersonLifecycleEventInput,
  ): IgaOutboundExternalWorkforceEventV1 {
    const body = this.buildPayload(
      IgaEventType.EXTERNAL_PERSON_TERMINATED,
      input.contractor,
      input.engagement,
    );
    return {
      version: IGA_EVENT_CONTRACT_VERSION,
      source: IGA_EVENT_SOURCE,
      ...body,
    };
  }

  /**
   * `EXTERNAL_PERSON_RESPONSIBLE_MANAGER_ASSIGNED` — requires a non-empty primary sponsor id on the engagement slice.
   */
  buildSponsorAssigned(input: BuildSponsorAssignedEventInput): IgaOutboundExternalWorkforceEventV1 {
    const sid = input.engagement.responsibleManagerEmployeeId?.trim();
    if (!sid) {
      throw new BadRequestException(
        'EXTERNAL_PERSON_RESPONSIBLE_MANAGER_ASSIGNED requires responsibleManagerEmployeeId (primary sponsor reference)',
      );
    }
    const engagement: IgaEventEngagementSponsorSlice = {
      ...input.engagement,
      responsibleManagerEmployeeId: sid,
    };
    const body = this.buildPayload(
      IgaEventType.EXTERNAL_PERSON_RESPONSIBLE_MANAGER_ASSIGNED,
      input.contractor,
      engagement,
    );
    return {
      version: IGA_EVENT_CONTRACT_VERSION,
      source: IGA_EVENT_SOURCE,
      ...body,
    };
  }
}
