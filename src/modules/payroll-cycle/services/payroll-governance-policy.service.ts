import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  GovernancePolicyDraftStatus,
  GovernancePolicyScope,
  PayrunBankReconciliationStatus,
  PayrunFinancialControlStatus,
  PayrunGLReconciliationStatus,
  Prisma,
  type PayrollGovernancePolicy,
} from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import type { GovernancePolicyRecordDto } from '../dto/governance-policy.dto';
import type { GovernancePolicyDraftDto } from '../dto/governance-policy-draft.dto';
import type {
  GovernancePolicyImpactDiffDto,
  GovernancePolicyImpactPreviewRequestDto,
  GovernancePolicyImpactPreviewResponseDto,
} from '../dto/governance-policy-impact.dto';
import type { PortfolioGateUser } from './payroll-governance-portfolio.service';
import { validateGovernancePolicyValue, coerceNumber } from './governance-policy-value.validator';
import { computeGovernancePolicyImpactPayloadHash } from './governance-policy-payload-hash';
import {
  GOV_POLICY_KEY_BANK_FEE_TOLERANCE,
  GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY,
  GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
  GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE,
  GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
} from '../constants/governance-policy-keys';
import { DEFAULT_NET_VARIANCE_THRESHOLD } from '../../payruns/payrun-financial-control.service';
import { DEFAULT_BANK_TOTAL_TOLERANCE } from '../../payruns/payrun-bank-reconciliation.service';
import { DEFAULT_GL_ROUNDING_EPSILON } from '../../payruns/payrun-gl-reconciliation.service';
import { PAYRUN_READINESS_OVERRIDE_JUSTIFICATION_MIN } from '../../payruns/payrun-readiness-gate.service';

const HEURISTIC_SIMULATION_DISCLAIMER =
  'Preview is heuristic and does not replace final gate evaluation.';

export type CreateGovernancePolicyVersionInput = {
  policy_key: string;
  scope: GovernancePolicyScope;
  legal_entity_id?: string | null;
  pay_group_id?: string | null;
  current_value: Prisma.JsonValue;
  effective_from?: string;
  /** GOV-6C — required for every version create (governance approval trace). */
  approval_reference: string;
  /** GOV-7A — must match `payload_hash` from impact preview for the same canonical payload. */
  impact_preview_hash: string;
};

export type GovernancePolicyScopeQueryInput = {
  policy_key: string;
  scope: GovernancePolicyScope;
  legal_entity_id?: string | null;
  pay_group_id?: string | null;
};

@Injectable()
export class PayrollGovernancePolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertLegalEntity(user: PortfolioGateUser, legalEntityId: string): void {
    if (user.hasGlobalScope) return;
    const allowed = user.legalEntityAccess ?? [];
    if (!allowed.includes(legalEntityId)) {
      throw new ForbiddenException({
        code: 'PAYROLL_GOVERNANCE_POLICY_DENIED',
        message: 'No access to this legal entity for governance policies.',
      });
    }
  }

  /**
   * Validates scope dimensions and portfolio access for a specific policy chain
   * (used by version create and version history).
   */
  private async resolvePolicyScopeDimensions(
    user: PortfolioGateUser,
    scope: GovernancePolicyScope,
    legalEntityIdIn: string | null | undefined,
    payGroupIdIn: string | null | undefined,
  ): Promise<{ legalEntityId: string | null; payGroupId: string | null }> {
    let legalEntityId: string | null = legalEntityIdIn ?? null;
    const payGroupId: string | null = payGroupIdIn ?? null;

    if (scope === GovernancePolicyScope.GLOBAL) {
      if (legalEntityId || payGroupId) {
        throw new BadRequestException({
          code: 'INVALID_SCOPE',
          message: 'GLOBAL scope must not include legal_entity_id or pay_group_id',
        });
      }
      if (!user.hasGlobalScope) {
        throw new ForbiddenException({
          code: 'PAYROLL_GOVERNANCE_POLICY_GLOBAL_DENIED',
          message: 'Only globally scoped operators may access GLOBAL governance policies.',
        });
      }
      return { legalEntityId: null, payGroupId: null };
    }

    if (scope === GovernancePolicyScope.LEGAL_ENTITY) {
      if (!legalEntityId || payGroupId) {
        throw new BadRequestException({
          code: 'INVALID_SCOPE',
          message: 'LEGAL_ENTITY scope requires legal_entity_id and must not set pay_group_id',
        });
      }
      this.assertLegalEntity(user, legalEntityId);
      return { legalEntityId, payGroupId: null };
    }

    if (scope === GovernancePolicyScope.PAY_GROUP) {
      if (!payGroupId) {
        throw new BadRequestException({
          code: 'INVALID_SCOPE',
          message: 'PAY_GROUP scope requires pay_group_id',
        });
      }
      const pg = await this.prisma.payGroup.findUnique({
        where: { id: payGroupId },
        select: { legalEntityId: true },
      });
      if (!pg) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pay group not found' });
      }
      this.assertLegalEntity(user, pg.legalEntityId);
      if (!legalEntityId) {
        legalEntityId = pg.legalEntityId;
      } else if (legalEntityId !== pg.legalEntityId) {
        throw new BadRequestException({
          code: 'LEGAL_ENTITY_PAY_GROUP_MISMATCH',
          message: 'legal_entity_id must match the pay group legal entity',
        });
      }
      return { legalEntityId, payGroupId };
    }

    throw new BadRequestException({ code: 'INVALID_SCOPE', message: 'Unknown governance policy scope' });
  }

  async listCurrentPolicies(
    user: PortfolioGateUser,
    query: { legal_entity_id?: string; pay_group_id?: string },
  ): Promise<GovernancePolicyRecordDto[]> {
    const noEntityFilter = !query.legal_entity_id && !query.pay_group_id;
    if (noEntityFilter) {
      if (!user.hasGlobalScope) {
        throw new BadRequestException({
          code: 'GOVERNANCE_POLICY_QUERY_REQUIRED',
          message: 'Provide legal_entity_id or pay_group_id unless you have global scope.',
        });
      }
      const rows = await this.prisma.payrollGovernancePolicy.findMany({
        where: { supersededByPolicyId: null },
        orderBy: [{ policyKey: 'asc' }, { effectiveFrom: 'desc' }],
      });
      return rows.map((r) => this.toDto(r));
    }

    const or: Prisma.PayrollGovernancePolicyWhereInput[] = [{ scope: GovernancePolicyScope.GLOBAL }];

    if (query.pay_group_id) {
      const pg = await this.prisma.payGroup.findUnique({
        where: { id: query.pay_group_id },
        select: { legalEntityId: true },
      });
      if (!pg) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pay group not found' });
      }
      this.assertLegalEntity(user, pg.legalEntityId);
      or.push({ scope: GovernancePolicyScope.LEGAL_ENTITY, legalEntityId: pg.legalEntityId });
      or.push({ scope: GovernancePolicyScope.PAY_GROUP, payGroupId: query.pay_group_id });
    } else if (query.legal_entity_id) {
      this.assertLegalEntity(user, query.legal_entity_id);
      or.push({ scope: GovernancePolicyScope.LEGAL_ENTITY, legalEntityId: query.legal_entity_id });
    }

    const rows = await this.prisma.payrollGovernancePolicy.findMany({
      where: {
        supersededByPolicyId: null,
        OR: or,
      },
      orderBy: [{ policyKey: 'asc' }, { effectiveFrom: 'desc' }],
    });

    return rows.map((r) => this.toDto(r));
  }

  /** GOV-6C — full version chain (including superseded rows) for one policy_key + scope dimensions. */
  async listPolicyVersionHistory(
    user: PortfolioGateUser,
    query: GovernancePolicyScopeQueryInput,
  ): Promise<GovernancePolicyRecordDto[]> {
    const policyKey = query.policy_key?.trim();
    if (!policyKey) {
      throw new BadRequestException({ code: 'INVALID_POLICY_KEY', message: 'policy_key is required' });
    }

    const scope = query.scope as GovernancePolicyScope;
    if (!Object.values(GovernancePolicyScope).includes(scope)) {
      throw new BadRequestException({ code: 'INVALID_SCOPE', message: 'scope must be GLOBAL, LEGAL_ENTITY, or PAY_GROUP' });
    }

    const { legalEntityId, payGroupId } = await this.resolvePolicyScopeDimensions(
      user,
      scope,
      query.legal_entity_id,
      query.pay_group_id,
    );

    const rows = await this.prisma.payrollGovernancePolicy.findMany({
      where: {
        policyKey,
        scope,
        legalEntityId: legalEntityId ?? null,
        payGroupId: payGroupId ?? null,
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((r) => this.toDto(r));
  }

  /** GOV-7A — impact preview for policy change (hash must be replayed on POST). */
  async governancePolicyImpactPreview(
    user: PortfolioGateUser,
    actorUserId: string,
    body: GovernancePolicyImpactPreviewRequestDto,
  ): Promise<GovernancePolicyImpactPreviewResponseDto> {
    const policyKey = body.policy_key?.trim();
    if (!policyKey) {
      throw new BadRequestException({ code: 'INVALID_POLICY_KEY', message: 'policy_key is required' });
    }

    const scope = body.scope as GovernancePolicyScope;
    if (!Object.values(GovernancePolicyScope).includes(scope)) {
      throw new BadRequestException({ code: 'INVALID_SCOPE', message: 'scope must be GLOBAL, LEGAL_ENTITY, or PAY_GROUP' });
    }

    if (body.current_value === undefined) {
      throw new BadRequestException({ code: 'INVALID_POLICY_VALUE', message: 'current_value is required' });
    }
    validateGovernancePolicyValue(policyKey, body.current_value);

    const { legalEntityId, payGroupId } = await this.resolvePolicyScopeDimensions(
      user,
      scope,
      body.legal_entity_id,
      body.pay_group_id,
    );

    const effectiveFrom = body.effective_from ? new Date(body.effective_from) : new Date();
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException({ code: 'INVALID_EFFECTIVE_FROM', message: 'effective_from must be a valid ISO date' });
    }

    const prior = await this.prisma.payrollGovernancePolicy.findFirst({
      where: {
        policyKey,
        scope,
        legalEntityId: legalEntityId ?? null,
        payGroupId: payGroupId ?? null,
        supersededByPolicyId: null,
      },
    });

    const previousValue = prior ? (prior.currentValue as unknown) : null;
    const proposedValue = body.current_value as unknown;

    const diff = this.buildImpactDiff(policyKey, previousValue, proposedValue);
    const simulation = await this.runHeuristicSimulation(
      policyKey,
      scope,
      legalEntityId,
      payGroupId,
      previousValue,
      proposedValue,
    );

    const payloadHash = computeGovernancePolicyImpactPayloadHash({
      policy_key: policyKey,
      scope,
      legal_entity_id: legalEntityId,
      pay_group_id: payGroupId,
      current_value: proposedValue,
      effective_from_iso: effectiveFrom.toISOString(),
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'GOV_POLICY_IMPACT_PREVIEW',
      entityType: 'PayrollGovernancePolicy',
      entityId: prior?.id ?? randomUUID(),
      newValue: {
        policy_key: policyKey,
        scope,
        legal_entity_id: legalEntityId,
        pay_group_id: payGroupId,
        payload_hash: payloadHash,
        diff_type: diff.type,
        diff_direction: diff.direction,
      },
    });

    return {
      policy_key: policyKey,
      scope,
      legal_entity_id: legalEntityId,
      pay_group_id: payGroupId,
      previous_value: previousValue,
      proposed_value: proposedValue,
      diff,
      simulation,
      payload_hash: payloadHash,
    };
  }

  /**
   * GOV-7B — direct active version create is disabled; use draft → approve → activate.
   */
  async createPolicyVersion(
    _user: PortfolioGateUser,
    _actorUserId: string,
    _body: CreateGovernancePolicyVersionInput,
  ): Promise<GovernancePolicyRecordDto> {
    throw new GoneException({
      code: 'GOV_POLICY_DIRECT_CREATE_DEPRECATED',
      message:
        'POST /api/payroll-cycle/governance-policies is disabled (GOV-7B). Use POST …/governance-policies/drafts, then …/drafts/:id/approve, then …/drafts/:id/activate.',
    });
  }

  private async resolveVersionCreatePayload(
    user: PortfolioGateUser,
    body: CreateGovernancePolicyVersionInput,
  ): Promise<{
    policyKey: string;
    scope: GovernancePolicyScope;
    legalEntityId: string | null;
    payGroupId: string | null;
    currentValue: Prisma.InputJsonValue;
    effectiveFrom: Date;
    previewHash: string;
    approvalRef: string;
  }> {
    const policyKey = body.policy_key?.trim();
    if (!policyKey) {
      throw new BadRequestException({ code: 'INVALID_POLICY_KEY', message: 'policy_key is required' });
    }

    const scope = body.scope as GovernancePolicyScope;
    if (!Object.values(GovernancePolicyScope).includes(scope)) {
      throw new BadRequestException({ code: 'INVALID_SCOPE', message: 'scope must be GLOBAL, LEGAL_ENTITY, or PAY_GROUP' });
    }

    const approvalRef = body.approval_reference?.trim();
    if (!approvalRef) {
      throw new BadRequestException({
        code: 'APPROVAL_REFERENCE_REQUIRED',
        message: 'approval_reference is required for governance policy changes',
      });
    }

    if (body.current_value === undefined) {
      throw new BadRequestException({ code: 'INVALID_POLICY_VALUE', message: 'current_value is required' });
    }
    validateGovernancePolicyValue(policyKey, body.current_value);

    const { legalEntityId, payGroupId } = await this.resolvePolicyScopeDimensions(
      user,
      scope,
      body.legal_entity_id,
      body.pay_group_id,
    );

    const effectiveFrom = body.effective_from ? new Date(body.effective_from) : new Date();
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException({ code: 'INVALID_EFFECTIVE_FROM', message: 'effective_from must be a valid ISO date' });
    }

    const previewHash = body.impact_preview_hash?.trim();
    if (!previewHash) {
      throw new BadRequestException({
        code: 'IMPACT_PREVIEW_HASH_REQUIRED',
        message: 'impact_preview_hash is required; run POST …/governance-policies/impact-preview and submit payload_hash.',
      });
    }
    const expectedHash = computeGovernancePolicyImpactPayloadHash({
      policy_key: policyKey,
      scope,
      legal_entity_id: legalEntityId,
      pay_group_id: payGroupId,
      current_value: body.current_value,
      effective_from_iso: effectiveFrom.toISOString(),
    });
    if (previewHash !== expectedHash) {
      throw new BadRequestException({
        code: 'IMPACT_PREVIEW_HASH_MISMATCH',
        message: 'impact_preview_hash does not match this payload; re-run impact preview after any edit.',
      });
    }

    return {
      policyKey,
      scope,
      legalEntityId,
      payGroupId,
      currentValue: body.current_value as Prisma.InputJsonValue,
      effectiveFrom,
      previewHash,
      approvalRef,
    };
  }

  private async applyActiveGovernancePolicyVersionInTx(
    tx: Prisma.TransactionClient,
    params: {
      policyKey: string;
      scope: GovernancePolicyScope;
      legalEntityId: string | null;
      payGroupId: string | null;
      currentValue: Prisma.InputJsonValue;
      effectiveFrom: Date;
      changedByUserId: string;
      approvalReference: string;
    },
  ): Promise<{ createdRow: PayrollGovernancePolicy; supersededPriorPolicyId: string | null }> {
    const prior = await tx.payrollGovernancePolicy.findFirst({
      where: {
        policyKey: params.policyKey,
        scope: params.scope,
        legalEntityId: params.legalEntityId ?? null,
        payGroupId: params.payGroupId ?? null,
        supersededByPolicyId: null,
      },
    });

    const row = await tx.payrollGovernancePolicy.create({
      data: {
        policyKey: params.policyKey,
        scope: params.scope,
        legalEntityId: params.legalEntityId,
        payGroupId: params.payGroupId,
        currentValue: params.currentValue,
        effectiveFrom: params.effectiveFrom,
        changedByUserId: params.changedByUserId,
        approvalReference: params.approvalReference,
      },
    });

    if (prior) {
      await tx.payrollGovernancePolicy.update({
        where: { id: prior.id },
        data: { supersededByPolicyId: row.id },
      });
    }

    return { createdRow: row, supersededPriorPolicyId: prior?.id ?? null };
  }

  async createGovernancePolicyDraft(
    user: PortfolioGateUser,
    actorUserId: string,
    body: CreateGovernancePolicyVersionInput,
  ): Promise<GovernancePolicyDraftDto> {
    const p = await this.resolveVersionCreatePayload(user, body);

    const draft = await this.prisma.payrollGovernancePolicyDraft.create({
      data: {
        policyKey: p.policyKey,
        scope: p.scope,
        legalEntityId: p.legalEntityId,
        payGroupId: p.payGroupId,
        proposedValue: p.currentValue,
        effectiveFrom: p.effectiveFrom,
        impactPreviewHash: p.previewHash,
        requestedByUserId: actorUserId,
        status: GovernancePolicyDraftStatus.PENDING_APPROVAL,
        approvalReference: p.approvalRef,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'GOV_POLICY_DRAFT_CREATE',
      entityType: 'PayrollGovernancePolicyDraft',
      entityId: draft.id,
      newValue: {
        policy_key: p.policyKey,
        scope: p.scope,
        legal_entity_id: p.legalEntityId,
        pay_group_id: p.payGroupId,
        impact_preview_hash: p.previewHash,
        approval_reference: p.approvalRef,
        status: GovernancePolicyDraftStatus.PENDING_APPROVAL,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'GOV_POLICY_DRAFT_SUBMIT',
      entityType: 'PayrollGovernancePolicyDraft',
      entityId: draft.id,
      newValue: {
        policy_key: p.policyKey,
        scope: p.scope,
        status: GovernancePolicyDraftStatus.PENDING_APPROVAL,
      },
    });

    return this.toDraftDto(draft);
  }

  async listGovernancePolicyDrafts(
    user: PortfolioGateUser,
    query: { legal_entity_id?: string; pay_group_id?: string; status?: GovernancePolicyDraftStatus },
  ): Promise<GovernancePolicyDraftDto[]> {
    const statusFilter = query.status;
    const noEntityFilter = !query.legal_entity_id && !query.pay_group_id;

    const baseWhere: Prisma.PayrollGovernancePolicyDraftWhereInput = statusFilter ? { status: statusFilter } : {};

    if (noEntityFilter) {
      if (!user.hasGlobalScope) {
        throw new BadRequestException({
          code: 'GOVERNANCE_POLICY_QUERY_REQUIRED',
          message: 'Provide legal_entity_id or pay_group_id unless you have global scope.',
        });
      }
      const rows = await this.prisma.payrollGovernancePolicyDraft.findMany({
        where: baseWhere,
        orderBy: [{ createdAt: 'desc' }],
      });
      return rows.map((r) => this.toDraftDto(r));
    }

    const or: Prisma.PayrollGovernancePolicyDraftWhereInput[] = [{ scope: GovernancePolicyScope.GLOBAL }];

    if (query.pay_group_id) {
      const pg = await this.prisma.payGroup.findUnique({
        where: { id: query.pay_group_id },
        select: { legalEntityId: true },
      });
      if (!pg) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pay group not found' });
      }
      this.assertLegalEntity(user, pg.legalEntityId);
      or.push({ scope: GovernancePolicyScope.LEGAL_ENTITY, legalEntityId: pg.legalEntityId });
      or.push({ scope: GovernancePolicyScope.PAY_GROUP, payGroupId: query.pay_group_id });
    } else if (query.legal_entity_id) {
      this.assertLegalEntity(user, query.legal_entity_id);
      or.push({ scope: GovernancePolicyScope.LEGAL_ENTITY, legalEntityId: query.legal_entity_id });
    }

    const rows = await this.prisma.payrollGovernancePolicyDraft.findMany({
      where: {
        ...baseWhere,
        OR: or,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return rows.map((r) => this.toDraftDto(r));
  }

  async approveGovernancePolicyDraft(
    user: PortfolioGateUser,
    actorUserId: string,
    draftId: string,
  ): Promise<GovernancePolicyDraftDto> {
    const draft = await this.prisma.payrollGovernancePolicyDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Governance policy draft not found' });
    }

    await this.resolvePolicyScopeDimensions(user, draft.scope, draft.legalEntityId, draft.payGroupId);

    if (draft.status !== GovernancePolicyDraftStatus.PENDING_APPROVAL) {
      throw new BadRequestException({
        code: 'GOV_POLICY_DRAFT_INVALID_STATE',
        message: `Draft must be PENDING_APPROVAL to approve (current: ${draft.status}).`,
      });
    }

    if (draft.requestedByUserId === actorUserId) {
      throw new ForbiddenException({
        code: 'GOV_POLICY_DRAFT_APPROVER_CANNOT_BE_REQUESTER',
        message: 'Approver cannot be the same user as the draft requester.',
      });
    }

    const updated = await this.prisma.payrollGovernancePolicyDraft.update({
      where: { id: draftId },
      data: {
        status: GovernancePolicyDraftStatus.APPROVED,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
      },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'GOV_POLICY_DRAFT_APPROVE',
      entityType: 'PayrollGovernancePolicyDraft',
      entityId: draftId,
      newValue: {
        policy_key: draft.policyKey,
        requested_by_user_id: draft.requestedByUserId,
        status: GovernancePolicyDraftStatus.APPROVED,
      },
    });

    return this.toDraftDto(updated);
  }

  /** GOV-7B-2 — approver rejects a pending draft (requester may not reject; use cancel). */
  async rejectGovernancePolicyDraft(
    user: PortfolioGateUser,
    actorUserId: string,
    draftId: string,
  ): Promise<GovernancePolicyDraftDto> {
    const draft = await this.prisma.payrollGovernancePolicyDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Governance policy draft not found' });
    }

    await this.resolvePolicyScopeDimensions(user, draft.scope, draft.legalEntityId, draft.payGroupId);

    if (draft.status !== GovernancePolicyDraftStatus.PENDING_APPROVAL) {
      throw new BadRequestException({
        code: 'GOV_POLICY_DRAFT_INVALID_STATE',
        message: `Draft must be PENDING_APPROVAL to reject (current: ${draft.status}).`,
      });
    }

    if (draft.requestedByUserId === actorUserId) {
      throw new ForbiddenException({
        code: 'GOV_POLICY_DRAFT_REQUESTER_CANNOT_REJECT',
        message: 'Requester cannot reject their own draft; use cancel instead.',
      });
    }

    const updated = await this.prisma.payrollGovernancePolicyDraft.update({
      where: { id: draftId },
      data: { status: GovernancePolicyDraftStatus.REJECTED },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'GOV_POLICY_DRAFT_REJECT',
      entityType: 'PayrollGovernancePolicyDraft',
      entityId: draftId,
      newValue: {
        policy_key: draft.policyKey,
        requested_by_user_id: draft.requestedByUserId,
        status: GovernancePolicyDraftStatus.REJECTED,
      },
    });

    return this.toDraftDto(updated);
  }

  /** GOV-7B-2 — requester withdraws their own pending draft. */
  async cancelGovernancePolicyDraft(
    user: PortfolioGateUser,
    actorUserId: string,
    draftId: string,
  ): Promise<GovernancePolicyDraftDto> {
    const draft = await this.prisma.payrollGovernancePolicyDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Governance policy draft not found' });
    }

    await this.resolvePolicyScopeDimensions(user, draft.scope, draft.legalEntityId, draft.payGroupId);

    if (draft.status !== GovernancePolicyDraftStatus.PENDING_APPROVAL) {
      throw new BadRequestException({
        code: 'GOV_POLICY_DRAFT_INVALID_STATE',
        message: `Draft must be PENDING_APPROVAL to cancel (current: ${draft.status}).`,
      });
    }

    if (draft.requestedByUserId !== actorUserId) {
      throw new ForbiddenException({
        code: 'GOV_POLICY_DRAFT_CANCEL_NOT_REQUESTER',
        message: 'Only the draft requester may cancel this draft.',
      });
    }

    const updated = await this.prisma.payrollGovernancePolicyDraft.update({
      where: { id: draftId },
      data: { status: GovernancePolicyDraftStatus.CANCELLED },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'GOV_POLICY_DRAFT_CANCEL',
      entityType: 'PayrollGovernancePolicyDraft',
      entityId: draftId,
      newValue: {
        policy_key: draft.policyKey,
        status: GovernancePolicyDraftStatus.CANCELLED,
      },
    });

    return this.toDraftDto(updated);
  }

  async activateGovernancePolicyDraft(
    user: PortfolioGateUser,
    actorUserId: string,
    draftId: string,
  ): Promise<GovernancePolicyRecordDto> {
    const draft = await this.prisma.payrollGovernancePolicyDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Governance policy draft not found' });
    }

    await this.resolvePolicyScopeDimensions(user, draft.scope, draft.legalEntityId, draft.payGroupId);

    if (draft.status !== GovernancePolicyDraftStatus.APPROVED) {
      throw new BadRequestException({
        code: 'GOV_POLICY_DRAFT_NOT_APPROVED',
        message: `Draft must be APPROVED before activation (current: ${draft.status}; rejected or cancelled drafts cannot activate).`,
      });
    }

    const expectedHash = computeGovernancePolicyImpactPayloadHash({
      policy_key: draft.policyKey,
      scope: draft.scope,
      legal_entity_id: draft.legalEntityId,
      pay_group_id: draft.payGroupId,
      current_value: draft.proposedValue as unknown,
      effective_from_iso: draft.effectiveFrom.toISOString(),
    });
    if (draft.impactPreviewHash !== expectedHash) {
      throw new BadRequestException({
        code: 'GOV_POLICY_DRAFT_HASH_INTEGRITY',
        message: 'Stored draft no longer matches impact preview hash; reject and recreate draft.',
      });
    }

    const { createdRow, supersededPriorPolicyId } = await this.prisma.$transaction(async (tx) => {
      const d = await tx.payrollGovernancePolicyDraft.findUnique({ where: { id: draftId } });
      if (!d || d.status !== GovernancePolicyDraftStatus.APPROVED) {
        throw new BadRequestException({ code: 'GOV_POLICY_DRAFT_RACE', message: 'Draft state changed during activation.' });
      }

      const out = await this.applyActiveGovernancePolicyVersionInTx(tx, {
        policyKey: d.policyKey,
        scope: d.scope,
        legalEntityId: d.legalEntityId,
        payGroupId: d.payGroupId,
        currentValue: d.proposedValue as Prisma.InputJsonValue,
        effectiveFrom: d.effectiveFrom,
        changedByUserId: actorUserId,
        approvalReference: d.approvalReference,
      });

      await tx.payrollGovernancePolicyDraft.update({
        where: { id: draftId },
        data: {
          status: GovernancePolicyDraftStatus.ACTIVATED,
          activationPolicyId: out.createdRow.id,
        },
      });

      return out;
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'GOV_POLICY_VERSION_CREATE',
      entityType: 'PayrollGovernancePolicy',
      entityId: createdRow.id,
      newValue: {
        policy_key: draft.policyKey,
        scope: draft.scope,
        legal_entity_id: draft.legalEntityId,
        pay_group_id: draft.payGroupId,
        effective_from: draft.effectiveFrom.toISOString(),
        approval_reference: draft.approvalReference,
        superseded_prior_policy_id: supersededPriorPolicyId,
        current_value: draft.proposedValue as unknown,
        impact_preview_hash: draft.impactPreviewHash,
        governance_policy_draft_id: draftId,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'GOV_POLICY_DRAFT_ACTIVATE',
      entityType: 'PayrollGovernancePolicyDraft',
      entityId: draftId,
      newValue: {
        activation_policy_id: createdRow.id,
        policy_key: draft.policyKey,
      },
    });

    return this.toDto(createdRow);
  }

  private defaultNumericBaseline(policyKey: string): number {
    switch (policyKey) {
      case GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD:
        return DEFAULT_NET_VARIANCE_THRESHOLD;
      case GOV_POLICY_KEY_BANK_FEE_TOLERANCE:
        return DEFAULT_BANK_TOTAL_TOLERANCE;
      case GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE:
        return DEFAULT_GL_ROUNDING_EPSILON;
      case GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH:
        return PAYRUN_READINESS_OVERRIDE_JUSTIFICATION_MIN;
      default:
        return 0;
    }
  }

  private payrunWhereForSimulation(
    scope: GovernancePolicyScope,
    legalEntityId: string | null,
    payGroupId: string | null,
  ): Prisma.PayRunWhereInput {
    if (scope === GovernancePolicyScope.PAY_GROUP) {
      return { payGroupId: payGroupId! };
    }
    if (scope === GovernancePolicyScope.LEGAL_ENTITY) {
      return { payGroup: { legalEntityId: legalEntityId! } };
    }
    return {};
  }

  private buildImpactDiff(
    policyKey: string,
    previousValue: unknown | null,
    proposedValue: unknown,
  ): GovernancePolicyImpactDiffDto {
    if (
      policyKey === GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD ||
      policyKey === GOV_POLICY_KEY_BANK_FEE_TOLERANCE ||
      policyKey === GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE
    ) {
      const prevN = previousValue === null || previousValue === undefined ? null : coerceNumber(previousValue);
      const propN = coerceNumber(proposedValue);
      const baseline = this.defaultNumericBaseline(policyKey);
      const oldT = prevN ?? baseline;
      if (propN === null) {
        return { type: 'UNKNOWN', direction: 'INITIAL', delta: null };
      }
      if (prevN === null) {
        return { type: 'INITIAL', direction: 'INITIAL', delta: propN - baseline };
      }
      const delta = propN - oldT;
      let direction: GovernancePolicyImpactDiffDto['direction'] = 'UNCHANGED';
      if (delta > 0) direction = 'RELAXED';
      else if (delta < 0) direction = 'TIGHTENED';
      return { type: 'THRESHOLD_CHANGE', direction, delta };
    }

    if (policyKey === GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH) {
      const prevN = previousValue === null || previousValue === undefined ? null : coerceNumber(previousValue);
      const propN = coerceNumber(proposedValue);
      const baseline = this.defaultNumericBaseline(policyKey);
      const oldT = prevN ?? baseline;
      if (propN === null) {
        return { type: 'UNKNOWN', direction: 'INITIAL', delta: null };
      }
      if (prevN === null) {
        return { type: 'INITIAL', direction: 'INITIAL', delta: propN - baseline };
      }
      const delta = propN - oldT;
      let direction: GovernancePolicyImpactDiffDto['direction'] = 'UNCHANGED';
      if (delta > 0) direction = 'TIGHTENED';
      else if (delta < 0) direction = 'RELAXED';
      return { type: 'JUSTIFICATION_LENGTH_CHANGE', direction, delta };
    }

    if (policyKey === GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY) {
      const prevMode =
        previousValue && typeof previousValue === 'object' && !Array.isArray(previousValue)
          ? String((previousValue as { mode?: unknown }).mode ?? '')
          : '';
      const propMode =
        proposedValue && typeof proposedValue === 'object' && !Array.isArray(proposedValue)
          ? String((proposedValue as { mode?: unknown }).mode ?? '')
          : '';
      const sr = this.modeStrictnessRank(prevMode);
      const sp = this.modeStrictnessRank(propMode);
      let direction: GovernancePolicyImpactDiffDto['direction'] = 'UNCHANGED';
      if (sp > sr) direction = 'TIGHTENED';
      else if (sp < sr) direction = 'RELAXED';
      return {
        type: 'MUTATION_POLICY_CHANGE',
        direction,
        delta: sp - sr,
        previous_mode: prevMode || null,
        proposed_mode: propMode || null,
      };
    }

    return { type: 'UNKNOWN', direction: 'INITIAL', delta: null };
  }

  private modeStrictnessRank(mode: string): number {
    const u = mode.toUpperCase();
    if (u === 'STANDARD') return 0;
    if (u === 'GOVERNED_PATHS_ONLY' || u === 'GOVERNED_ONLY') return 1;
    return 0;
  }

  private async runHeuristicSimulation(
    policyKey: string,
    scope: GovernancePolicyScope,
    legalEntityId: string | null,
    payGroupId: string | null,
    previousValue: unknown | null,
    proposedValue: unknown,
  ): Promise<{
    quality: 'HEURISTIC';
    affected_payruns_checked: number;
    would_unblock_count: number;
    would_block_count: number;
    disclaimer: string;
  }> {
    const where = this.payrunWhereForSimulation(scope, legalEntityId, payGroupId);

    if (policyKey === GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD) {
      const oldT =
        (previousValue === null || previousValue === undefined ? null : coerceNumber(previousValue)) ??
        this.defaultNumericBaseline(policyKey);
      const newT = coerceNumber(proposedValue);
      if (newT === null) {
        return {
          quality: 'HEURISTIC',
          affected_payruns_checked: 0,
          would_unblock_count: 0,
          would_block_count: 0,
          disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
        };
      }
      const payrunIds = (
        await this.prisma.payRun.findMany({
          where,
          select: { id: true },
          take: 500,
          orderBy: { updatedAt: 'desc' },
        })
      ).map((p) => p.id);
      if (payrunIds.length === 0) {
        return {
          quality: 'HEURISTIC',
          affected_payruns_checked: 0,
          would_unblock_count: 0,
          would_block_count: 0,
          disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
        };
      }
      const rows = await this.prisma.payrunFinancialControl.findMany({
        where: { payrunId: { in: payrunIds } },
        select: { status: true, varianceAmount: true, blockedReasonsJson: true },
      });
      let wouldUnblock = 0;
      let wouldBlock = 0;
      for (const r of rows) {
        const absV = Math.abs(Number(r.varianceAmount));
        const reasons = Array.isArray(r.blockedReasonsJson) ? (r.blockedReasonsJson as string[]) : [];
        const netBlocked =
          r.status === PayrunFinancialControlStatus.BLOCKED && reasons.includes('NET_TOTAL_BEYOND_THRESHOLD');
        if (netBlocked && absV > oldT && absV <= newT) {
          wouldUnblock += 1;
        }
        if (
          (r.status === PayrunFinancialControlStatus.MATCH || r.status === PayrunFinancialControlStatus.VARIANCE) &&
          absV > newT &&
          absV <= oldT
        ) {
          wouldBlock += 1;
        }
      }
      return {
        quality: 'HEURISTIC',
        affected_payruns_checked: rows.length,
        would_unblock_count: wouldUnblock,
        would_block_count: wouldBlock,
        disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
      };
    }

    if (policyKey === GOV_POLICY_KEY_BANK_FEE_TOLERANCE) {
      const oldT =
        (previousValue === null || previousValue === undefined ? null : coerceNumber(previousValue)) ??
        this.defaultNumericBaseline(policyKey);
      const newT = coerceNumber(proposedValue);
      if (newT === null) {
        return {
          quality: 'HEURISTIC',
          affected_payruns_checked: 0,
          would_unblock_count: 0,
          would_block_count: 0,
          disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
        };
      }
      const payrunIds = (
        await this.prisma.payRun.findMany({
          where,
          select: { id: true },
          take: 500,
          orderBy: { updatedAt: 'desc' },
        })
      ).map((p) => p.id);
      if (payrunIds.length === 0) {
        return {
          quality: 'HEURISTIC',
          affected_payruns_checked: 0,
          would_unblock_count: 0,
          would_block_count: 0,
          disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
        };
      }
      const rows = await this.prisma.payrunBankReconciliation.findMany({
        where: { payrunId: { in: payrunIds } },
        select: { status: true, varianceAmount: true, blockedReasonsJson: true },
      });
      let wouldUnblock = 0;
      let wouldBlock = 0;
      for (const r of rows) {
        const absV = Math.abs(Number(r.varianceAmount));
        const reasons = Array.isArray(r.blockedReasonsJson) ? (r.blockedReasonsJson as string[]) : [];
        const bankBlocked =
          r.status === PayrunBankReconciliationStatus.BLOCKED && reasons.includes('BANK_TOTAL_MISMATCH');
        if (bankBlocked && absV > oldT && absV <= newT) {
          wouldUnblock += 1;
        }
        if (
          (r.status === PayrunBankReconciliationStatus.MATCH || r.status === PayrunBankReconciliationStatus.VARIANCE) &&
          absV > newT &&
          absV <= oldT
        ) {
          wouldBlock += 1;
        }
      }
      return {
        quality: 'HEURISTIC',
        affected_payruns_checked: rows.length,
        would_unblock_count: wouldUnblock,
        would_block_count: wouldBlock,
        disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
      };
    }

    if (policyKey === GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE) {
      const oldT =
        (previousValue === null || previousValue === undefined ? null : coerceNumber(previousValue)) ??
        this.defaultNumericBaseline(policyKey);
      const newT = coerceNumber(proposedValue);
      if (newT === null) {
        return {
          quality: 'HEURISTIC',
          affected_payruns_checked: 0,
          would_unblock_count: 0,
          would_block_count: 0,
          disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
        };
      }
      const payrunIds = (
        await this.prisma.payRun.findMany({
          where,
          select: { id: true },
          take: 500,
          orderBy: { updatedAt: 'desc' },
        })
      ).map((p) => p.id);
      if (payrunIds.length === 0) {
        return {
          quality: 'HEURISTIC',
          affected_payruns_checked: 0,
          would_unblock_count: 0,
          would_block_count: 0,
          disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
        };
      }
      const rows = await this.prisma.payrunGLReconciliation.findMany({
        where: { payrunId: { in: payrunIds } },
        select: { status: true, varianceAmount: true },
      });
      let wouldUnblock = 0;
      let wouldBlock = 0;
      for (const r of rows) {
        const absV = Math.abs(Number(r.varianceAmount));
        if (r.status === PayrunGLReconciliationStatus.BLOCKED && absV > oldT && absV <= newT) {
          wouldUnblock += 1;
        }
        if (
          (r.status === PayrunGLReconciliationStatus.MATCH || r.status === PayrunGLReconciliationStatus.VARIANCE) &&
          absV > newT &&
          absV <= oldT
        ) {
          wouldBlock += 1;
        }
      }
      return {
        quality: 'HEURISTIC',
        affected_payruns_checked: rows.length,
        would_unblock_count: wouldUnblock,
        would_block_count: wouldBlock,
        disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
      };
    }

    return {
      quality: 'HEURISTIC',
      affected_payruns_checked: 0,
      would_unblock_count: 0,
      would_block_count: 0,
      disclaimer: HEURISTIC_SIMULATION_DISCLAIMER,
    };
  }

  private toDraftDto(r: {
    id: string;
    policyKey: string;
    scope: GovernancePolicyScope;
    legalEntityId: string | null;
    payGroupId: string | null;
    proposedValue: Prisma.JsonValue;
    effectiveFrom: Date;
    impactPreviewHash: string;
    requestedByUserId: string;
    approvedByUserId: string | null;
    approvedAt: Date | null;
    status: GovernancePolicyDraftStatus;
    activationPolicyId: string | null;
    approvalReference: string;
    createdAt: Date;
    updatedAt: Date;
  }): GovernancePolicyDraftDto {
    return {
      id: r.id,
      policy_key: r.policyKey,
      scope: r.scope,
      legal_entity_id: r.legalEntityId,
      pay_group_id: r.payGroupId,
      proposed_value: r.proposedValue as unknown,
      effective_from: r.effectiveFrom.toISOString(),
      impact_preview_hash: r.impactPreviewHash,
      requested_by_user_id: r.requestedByUserId,
      approved_by_user_id: r.approvedByUserId,
      approved_at: r.approvedAt ? r.approvedAt.toISOString() : null,
      status: r.status,
      activation_policy_id: r.activationPolicyId,
      approval_reference: r.approvalReference,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    };
  }

  private toDto(r: {
    id: string;
    policyKey: string;
    scope: GovernancePolicyScope;
    legalEntityId: string | null;
    payGroupId: string | null;
    currentValue: Prisma.JsonValue;
    effectiveFrom: Date;
    changedByUserId: string;
    approvalReference: string | null;
    supersededByPolicyId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): GovernancePolicyRecordDto {
    return {
      id: r.id,
      policy_key: r.policyKey,
      scope: r.scope,
      legal_entity_id: r.legalEntityId,
      pay_group_id: r.payGroupId,
      current_value: r.currentValue as unknown,
      effective_from: r.effectiveFrom.toISOString(),
      changed_by_user_id: r.changedByUserId,
      approval_reference: r.approvalReference,
      superseded_by_policy_id: r.supersededByPolicyId,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    };
  }
}
