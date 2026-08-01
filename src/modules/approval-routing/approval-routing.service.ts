import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { OrgGraphService } from '../hierarchy/org-graph.service';
import {
  RoutingContext,
  RouteResolutionResult,
  RouteStep,
  RouteAttempt,
  ResolutionType,
  REASON_CODES,
} from './approval-routing.types';
import {
  ROUTING_POLICIES,
  POLICY_LABELS,
  REQUEST_TYPES,
  FALLBACK_ROLES,
  getRequiredApprovalCapability,
} from './approval-routing.policy';
import { SimulateApprovalDto } from './dto/simulate-approval.dto';

type EligibleUser = {
  userId: string;
  employeeId?: string;
  fullName: string;
};

@Injectable()
export class ApprovalRoutingService {
  private readonly logger = new Logger(ApprovalRoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orgGraph: OrgGraphService,
  ) {}

  async simulateRoute(dto: SimulateApprovalDto): Promise<RouteResolutionResult> {
    const context: RoutingContext = {
      requesterEmployeeId: dto.requester_employee_id,
      requestType: dto.request_type,
      routingPolicy: dto.routing_policy,
      legalEntityId: dto.legal_entity_id,
      orgUnitId: dto.org_unit_id,
      roleFallback: dto.role_fallback,
    };
    return this.resolveRoute(context);
  }

  async resolveRoute(ctx: RoutingContext): Promise<RouteResolutionResult> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: ctx.requesterEmployeeId },
      include: {
        employments: {
          include: {
            legalEntity: true,
            employmentAssignments: { include: { orgUnit: true } },
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!employee) {
      return this.unresolvedResult(ctx, [{
        resolution_type: 'MANAGER',
        status: 'FAILED',
        reason_code: 'REQUESTER_EMPLOYEE_NOT_FOUND',
        reason: REASON_CODES.REQUESTER_EMPLOYEE_NOT_FOUND,
      }]);
    }

    const now = new Date();
    const currentEmployment = employee.employments.find(
      (e) => e.effectiveFrom <= now && (!e.effectiveTo || e.effectiveTo >= now),
    ) ?? employee.employments[0];

    const legalEntityId = ctx.legalEntityId
      ?? currentEmployment?.legalEntityId
      ?? employee.legalEntityId
      ?? undefined;

    const currentAssignment = currentEmployment?.employmentAssignments?.find(
      (a) => a.effectiveFrom <= now && (!a.effectiveTo || a.effectiveTo >= now),
    ) ?? currentEmployment?.employmentAssignments?.[0];

    const orgUnitId = ctx.orgUnitId
      ?? currentAssignment?.orgUnitId
      ?? undefined;

    const enrichedCtx: RoutingContext = {
      ...ctx,
      legalEntityId,
      orgUnitId,
    };

    const requesterUserId = employee.userId ?? undefined;
    const policySteps = ROUTING_POLICIES[ctx.routingPolicy];
    if (!policySteps) {
      return this.unresolvedResult(enrichedCtx, [{
        resolution_type: 'MANAGER',
        status: 'FAILED',
        reason_code: 'STEP_NOT_REQUIRED_BY_POLICY',
        reason: `Unknown routing policy: ${ctx.routingPolicy}`,
      }]);
    }

    const allTypes: ResolutionType[] = ['MANAGER', 'SKIP_LEVEL_MANAGER', 'ORG_UNIT_FALLBACK', 'ROLE_FALLBACK'];
    const steps: RouteStep[] = [];
    const attempts: RouteAttempt[] = [];
    let usedFallback = false;

    for (const rType of allTypes) {
      if (!policySteps.includes(rType)) {
        attempts.push({
          resolution_type: rType,
          status: 'NOT_USED',
          reason_code: 'STEP_NOT_REQUIRED_BY_POLICY',
          reason: REASON_CODES.STEP_NOT_REQUIRED_BY_POLICY,
        });
        continue;
      }

      const result = await this.resolveLayer(rType, enrichedCtx, requesterUserId);

      if (result.eligible) {
        const isFallback = rType === 'ORG_UNIT_FALLBACK' || rType === 'ROLE_FALLBACK';
        if (isFallback) usedFallback = true;

        steps.push({
          level: steps.length + 1,
          resolution_type: rType,
          approver_user_id: result.eligible.userId,
          approver_employee_id: result.eligible.employeeId,
          approver_name: result.eligible.fullName,
          reason_code: result.reasonCode,
          reason: result.reason,
        });
        attempts.push({
          resolution_type: rType,
          status: 'RESOLVED',
          reason_code: result.reasonCode,
          reason: result.reason,
        });
      } else {
        attempts.push({
          resolution_type: rType,
          status: 'FAILED',
          reason_code: result.reasonCode,
          reason: result.reason,
        });
      }
    }

    const status = steps.length === 0
      ? 'UNRESOLVED'
      : usedFallback
        ? 'RESOLVED_WITH_FALLBACK'
        : 'RESOLVED';

    return {
      status,
      policy: ctx.routingPolicy,
      requester: {
        employee_id: employee.id,
        employee_no: employee.employeeNo,
        full_name: `${employee.firstName} ${employee.lastName}`,
        legal_entity_id: legalEntityId,
        org_unit_id: orgUnitId,
      },
      steps,
      attempts,
      meta: {
        fallback_used: usedFallback,
        resolved_steps: steps.length,
        generated_at: new Date().toISOString(),
      },
    };
  }

  private async resolveLayer(
    type: ResolutionType,
    ctx: RoutingContext,
    requesterUserId?: string,
  ): Promise<{ eligible: EligibleUser | null; reasonCode: string; reason: string }> {
    switch (type) {
      case 'MANAGER':
        return this.resolveManager(ctx, requesterUserId);
      case 'SKIP_LEVEL_MANAGER':
        return this.resolveSkipLevel(ctx, requesterUserId);
      case 'ORG_UNIT_FALLBACK':
        return this.resolveOrgFallback(ctx, requesterUserId);
      case 'ROLE_FALLBACK':
        return this.resolveRoleFallback(ctx, requesterUserId);
    }
  }

  private async resolveManager(
    ctx: RoutingContext,
    requesterUserId?: string,
  ): Promise<{ eligible: EligibleUser | null; reasonCode: string; reason: string }> {
    const managerId = await this.orgGraph.getManager(ctx.requesterEmployeeId);
    if (!managerId) {
      return { eligible: null, reasonCode: 'NO_MANAGER_ASSIGNED', reason: REASON_CODES.NO_MANAGER_ASSIGNED };
    }
    return this.checkEmployeeEligibility(managerId, ctx, requesterUserId);
  }

  private async resolveSkipLevel(
    ctx: RoutingContext,
    requesterUserId?: string,
  ): Promise<{ eligible: EligibleUser | null; reasonCode: string; reason: string }> {
    const chain = await this.orgGraph.getManagerChain(ctx.requesterEmployeeId);
    if (chain.length < 2) {
      return { eligible: null, reasonCode: 'NO_SKIP_LEVEL_AVAILABLE', reason: REASON_CODES.NO_SKIP_LEVEL_AVAILABLE };
    }

    for (const candidateId of chain.slice(1)) {
      const result = await this.checkEmployeeEligibility(candidateId, ctx, requesterUserId);
      if (result.eligible) {
        return {
          eligible: result.eligible,
          reasonCode: 'SKIP_LEVEL_MANAGER_ELIGIBLE',
          reason: REASON_CODES.SKIP_LEVEL_MANAGER_ELIGIBLE,
        };
      }
    }

    return { eligible: null, reasonCode: 'NO_SKIP_LEVEL_AVAILABLE', reason: REASON_CODES.NO_SKIP_LEVEL_AVAILABLE };
  }

  private async resolveOrgFallback(
    ctx: RoutingContext,
    requesterUserId?: string,
  ): Promise<{ eligible: EligibleUser | null; reasonCode: string; reason: string }> {
    if (!ctx.orgUnitId) {
      return { eligible: null, reasonCode: 'NO_ORG_UNIT_MANAGER_FOUND', reason: REASON_CODES.NO_ORG_UNIT_MANAGER_FOUND };
    }

    const visited = new Set<string>();
    let currentOrgUnitId: string | null = ctx.orgUnitId;

    while (currentOrgUnitId && !visited.has(currentOrgUnitId)) {
      visited.add(currentOrgUnitId);
      const ouRecord: { managerEmployeeId: string | null; parentOrgUnitId: string | null } | null =
        await this.prisma.orgUnit.findUnique({
          where: { id: currentOrgUnitId },
          select: { managerEmployeeId: true, parentOrgUnitId: true },
        });

      if (!ouRecord) break;

      if (ouRecord.managerEmployeeId) {
        const result = await this.checkEmployeeEligibility(ouRecord.managerEmployeeId, ctx, requesterUserId);
        if (result.eligible) {
          return {
            eligible: result.eligible,
            reasonCode: 'ORG_UNIT_MANAGER_FOUND',
            reason: REASON_CODES.ORG_UNIT_MANAGER_FOUND,
          };
        }
      }

      currentOrgUnitId = ouRecord.parentOrgUnitId;
    }

    return { eligible: null, reasonCode: 'NO_ORG_UNIT_MANAGER_FOUND', reason: REASON_CODES.NO_ORG_UNIT_MANAGER_FOUND };
  }

  private async resolveRoleFallback(
    ctx: RoutingContext,
    requesterUserId?: string,
  ): Promise<{ eligible: EligibleUser | null; reasonCode: string; reason: string }> {
    const targetRole = ctx.roleFallback ?? getRequiredApprovalCapability(ctx.requestType);
    if (!targetRole) {
      return { eligible: null, reasonCode: 'NO_ELIGIBLE_ROLE_HOLDER_IN_SCOPE', reason: REASON_CODES.NO_ELIGIBLE_ROLE_HOLDER_IN_SCOPE };
    }

    const usersWithRole = await this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: { some: { role: { name: targetRole as any } } },
      },
      include: {
        employee: { select: { id: true, legalEntityId: true } },
        legalEntityAccess: { select: { legalEntityId: true } },
      },
    });

    if (ctx.legalEntityId) {
      const scopedUser = usersWithRole.find((u) => {
        if (requesterUserId && u.id === requesterUserId) return false;
        const hasAccess = u.legalEntityAccess.some((a) => a.legalEntityId === ctx.legalEntityId);
        return hasAccess;
      });

      if (scopedUser) {
        return {
          eligible: {
            userId: scopedUser.id,
            employeeId: scopedUser.employee?.id,
            fullName: `${scopedUser.firstName} ${scopedUser.lastName}`,
          },
          reasonCode: 'SCOPED_ROLE_HOLDER_FOUND',
          reason: REASON_CODES.SCOPED_ROLE_HOLDER_FOUND,
        };
      }
    }

    const globalUser = usersWithRole.find((u) => {
      if (requesterUserId && u.id === requesterUserId) return false;
      return true;
    });

    if (globalUser) {
      return {
        eligible: {
          userId: globalUser.id,
          employeeId: globalUser.employee?.id,
          fullName: `${globalUser.firstName} ${globalUser.lastName}`,
        },
        reasonCode: 'GLOBAL_ROLE_HOLDER_FOUND',
        reason: REASON_CODES.GLOBAL_ROLE_HOLDER_FOUND,
      };
    }

    return { eligible: null, reasonCode: 'NO_ELIGIBLE_ROLE_HOLDER_IN_SCOPE', reason: REASON_CODES.NO_ELIGIBLE_ROLE_HOLDER_IN_SCOPE };
  }

  private async checkEmployeeEligibility(
    employeeId: string,
    ctx: RoutingContext,
    requesterUserId?: string,
  ): Promise<{ eligible: EligibleUser | null; reasonCode: string; reason: string }> {
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          include: {
            legalEntityAccess: { select: { legalEntityId: true } },
          },
        },
      },
    });

    if (!emp?.user) {
      return { eligible: null, reasonCode: 'MANAGER_HAS_NO_LINKED_USER', reason: REASON_CODES.MANAGER_HAS_NO_LINKED_USER };
    }

    if (!emp.user.isActive) {
      return { eligible: null, reasonCode: 'MANAGER_USER_INACTIVE', reason: REASON_CODES.MANAGER_USER_INACTIVE };
    }

    if (requesterUserId && emp.user.id === requesterUserId) {
      return { eligible: null, reasonCode: 'SELF_APPROVAL_NOT_ALLOWED', reason: REASON_CODES.SELF_APPROVAL_NOT_ALLOWED };
    }

    return {
      eligible: {
        userId: emp.user.id,
        employeeId: emp.id,
        fullName: `${emp.firstName} ${emp.lastName}`,
      },
      reasonCode: 'DIRECT_MANAGER_ACTIVE_AND_ELIGIBLE',
      reason: 'Active user with linked employee',
    };
  }

  getPolicies() {
    return {
      items: Object.entries(POLICY_LABELS).map(([code, label]) => ({ code, label })),
    };
  }

  getRequestTypes() {
    return { items: REQUEST_TYPES.map((r) => ({ ...r })) };
  }

  getFallbackRoles() {
    return { items: FALLBACK_ROLES.map((r) => ({ ...r })) };
  }

  private unresolvedResult(ctx: RoutingContext, attempts: RouteAttempt[]): RouteResolutionResult {
    return {
      status: 'UNRESOLVED',
      policy: ctx.routingPolicy,
      requester: {
        employee_id: ctx.requesterEmployeeId,
        full_name: '',
      },
      steps: [],
      attempts,
      meta: {
        fallback_used: false,
        resolved_steps: 0,
        generated_at: new Date().toISOString(),
      },
    };
  }
}
