import { Injectable } from '@nestjs/common';
import { ContractorWorkforceState } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS, ContractorWorkforceDomainEvent } from './contractor-workforce-domain-events.constants';

export type WorkforceDomainEventPayload = {
  contractorId: string;
  organizationId: string | null;
  actorUserId: string | null;
  fromState: ContractorWorkforceState;
  toState: ContractorWorkforceState;
  domainEvent: ContractorWorkforceDomainEvent;
  reason?: string;
};

/**
 * PR-WORKFORCE-STATE-MODEL-1 — stub publisher (audit-only until bus handlers ship).
 */
@Injectable()
export class ContractorWorkforceEventPublisherService {
  constructor(private readonly auditService: AuditService) {}

  async publishStub(payload: WorkforceDomainEventPayload): Promise<void> {
    await this.auditService.logAction(
      payload.actorUserId,
      'CONTRACTOR_WORKFORCE_DOMAIN_EVENT',
      'Contractor',
      payload.contractorId,
      { workforceState: payload.fromState },
      { workforceState: payload.toState },
      {
        organizationId: payload.organizationId,
        metadata: {
          domainEvent: payload.domainEvent,
          fromState: payload.fromState,
          toState: payload.toState,
          reason: payload.reason ?? null,
          stub: true,
        },
      },
    );
  }

  /** Initial supplier-backed intake at NOMINATED — not a transition (PR-WORKFORCE-NOMINATE-1). */
  async publishNominationIntakeStub(payload: {
    contractorId: string;
    organizationId: string | null;
    actorUserId: string | null;
    reason?: string;
    engagementId?: string;
    responsibleManagerEmployeeId?: string | null;
  }): Promise<void> {
    await this.auditService.logAction(
      payload.actorUserId,
      'CONTRACTOR_WORKFORCE_DOMAIN_EVENT',
      'Contractor',
      payload.contractorId,
      null,
      { workforceState: ContractorWorkforceState.NOMINATED },
      {
        organizationId: payload.organizationId,
        metadata: {
          domainEvent: CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATED,
          fromState: null,
          toState: ContractorWorkforceState.NOMINATED,
          reason: payload.reason ?? null,
          engagementId: payload.engagementId ?? null,
          responsibleManagerEmployeeId: payload.responsibleManagerEmployeeId ?? null,
          intake: true,
          stub: true,
        },
      },
    );
  }
}
