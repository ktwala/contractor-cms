import { Injectable } from '@nestjs/common';
import {
  ContractorGovernanceRemediationStatus,
  ContractorGovernanceRemediationType,
  ContractorSourceDriftSeverity,
  ContractorSourceDriftStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import {
  eventTypeForDrift,
  GOVERNANCE_REMEDIATION_DUE_HOURS_CRITICAL,
  recommendedActionsForDrift,
  remediationTypeForDrift,
  shouldApplyPdpRestrictions,
} from './contractor-governance-remediation.constants';
import type { GovernanceRemediationEvent } from './types/governance-remediation-event.types';

const OPEN_DRIFT_FOR_REMEDIATION: ContractorSourceDriftStatus[] = [
  ContractorSourceDriftStatus.DETECTED,
  ContractorSourceDriftStatus.CLASSIFIED,
  ContractorSourceDriftStatus.UNDER_REVIEW,
];

/**
 * PR-CTR-CONNECTOR-1G — creates remediations from open drifts; emits governance contract events.
 */
@Injectable()
export class ContractorGovernanceRemediationOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async syncRemediationsForOrganization(
    organizationId: string,
    actorUserId?: string | null,
  ): Promise<{ created: number }> {
    const drifts = await this.prisma.contractorSourceDrift.findMany({
      where: {
        organizationId,
        status: { in: OPEN_DRIFT_FOR_REMEDIATION },
        remediation: null,
      },
    });

    let created = 0;
    for (const drift of drifts) {
      const remediation = await this.createRemediationForDrift(
        organizationId,
        drift.id,
        actorUserId,
      );
      if (remediation) {
        created += 1;
      }
    }
    return { created };
  }

  async createRemediationForDrift(
    organizationId: string,
    driftId: string,
    actorUserId?: string | null,
    remediationTypeOverride?: ContractorGovernanceRemediationType,
  ) {
    const drift = await this.prisma.contractorSourceDrift.findFirst({
      where: { id: driftId, organizationId },
    });
    if (!drift) {
      return null;
    }

    const existing = await this.prisma.contractorGovernanceRemediation.findUnique({
      where: { driftId },
    });
    if (existing) {
      return existing;
    }

    const remediationType =
      remediationTypeOverride ?? remediationTypeForDrift(drift.driftType);
    const applyPdp = shouldApplyPdpRestrictions(drift.driftType);
    const dueAt =
      drift.severity === ContractorSourceDriftSeverity.CRITICAL
        ? new Date(
            Date.now() + GOVERNANCE_REMEDIATION_DUE_HOURS_CRITICAL * 60 * 60 * 1000,
          )
        : null;

    const recommendedActions = recommendedActionsForDrift(drift.driftType);
    const eventType = eventTypeForDrift(drift.driftType);

    const remediation = await this.prisma.contractorGovernanceRemediation.create({
      data: {
        organizationId,
        driftId: drift.id,
        contractorId: drift.contractorId,
        remediationType,
        remediationStatus: ContractorGovernanceRemediationStatus.OPEN,
        dueAt,
        escalationLevel: drift.severity === ContractorSourceDriftSeverity.CRITICAL ? 1 : 0,
        downstreamActions: recommendedActions,
        pdpRestrictionsApplied: applyPdp,
        auditTrail: [
          {
            at: new Date().toISOString(),
            action: 'REMEDIATION_CREATED',
            actorUserId: actorUserId ?? null,
            driftType: drift.driftType,
          },
        ],
      },
    });

    const governanceEvent: GovernanceRemediationEvent = {
      eventType,
      organizationId,
      contractorId: drift.contractorId,
      driftId: drift.id,
      remediationId: remediation.id,
      severity: drift.severity,
      recommendedActions,
      emittedAt: new Date().toISOString(),
    };

    await this.emitGovernanceEvent(actorUserId, governanceEvent);

    return remediation;
  }

  private async emitGovernanceEvent(
    actorUserId: string | null | undefined,
    event: GovernanceRemediationEvent,
  ) {
    await this.auditService.logAction(
      actorUserId ?? 'system',
      'CONTRACTOR_GOVERNANCE_REMEDIATION_EVENT_EMITTED',
      'ContractorGovernanceRemediation',
      event.remediationId,
      null,
      event,
      { organizationId: event.organizationId },
    );
  }

  appendAuditTrail(
    existing: Prisma.JsonValue | null,
    entry: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const trail = Array.isArray(existing) ? [...existing] : [];
    trail.push(entry as Prisma.JsonValue);
    return trail as Prisma.InputJsonValue;
  }
}
