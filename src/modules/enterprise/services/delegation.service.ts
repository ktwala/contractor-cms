import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface Delegation {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  delegation_type: string;
  effective_from: Date;
  effective_to: Date | null;
  is_active: boolean;
}

@Injectable()
export class DelegationService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a delegation
   */
  async createDelegation(
    delegatorUserId: string,
    delegateUserId: string,
    delegationType: 'full' | 'partial' | 'approval_only' | 'view_only',
    effectiveFrom: string,
    effectiveTo: string | null,
    legalEntityId: string | null,
    departmentId: string | null,
    permissions: string[] | null,
    reason: string,
    requiresMfa: boolean,
    maxTransactionAmount: number | null,
    userId: string,
  ): Promise<string> {
    if (delegatorUserId === delegateUserId) {
      throw new Error('Cannot delegate to yourself');
    }

    const delegation = await (this.prisma as any).userDelegation.create({
      data: {
        delegatorUserId,
        delegateUserId,
        delegationType,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        legalEntityId,
        departmentId,
        permissions,
        reason,
        requiresMfa,
        maxTransactionAmount,
        createdBy: userId,
      },
    });

    return delegation.id;
  }

  /**
   * Get active delegations for a delegate user
   */
  async getActiveDelegations(delegateUserId: string): Promise<Delegation[]> {
    const now = new Date();

    const delegations = await (this.prisma as any).userDelegation.findMany({
      where: {
        delegateUserId,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      include: {
        delegator: { select: { firstName: true, lastName: true } },
        delegate: { select: { firstName: true, lastName: true } },
        legalEntity: { select: { entityName: true } },
        department: { select: { departmentName: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return delegations.map((d: any) => ({
      ...d,
      delegator_name: `${d.delegator.firstName} ${d.delegator.lastName}`,
      delegate_name: `${d.delegate.firstName} ${d.delegate.lastName}`,
      legal_entity_name: d.legalEntity?.entityName || null,
      department_name: d.department?.departmentName || null,
    }));
  }

  /**
   * Get delegations created by a delegator
   */
  async getDelegationsByDelegator(delegatorUserId: string): Promise<any[]> {
    const delegations = await (this.prisma as any).userDelegation.findMany({
      where: { delegatorUserId },
      include: {
        delegate: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return delegations.map((d: any) => ({
      ...d,
      delegate_name: `${d.delegate.firstName} ${d.delegate.lastName}`,
    }));
  }

  /**
   * Check if delegation is valid for an action
   */
  async validateDelegation(
    delegateUserId: string,
    delegatorUserId: string,
    permission: string,
    transactionAmount?: number,
  ): Promise<boolean> {
    const now = new Date();

    const delegation = await (this.prisma as any).userDelegation.findFirst({
      where: {
        delegateUserId,
        delegatorUserId,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
    });

    if (!delegation) {
      return false;
    }

    // Check delegation type
    if (delegation.delegationType === 'view_only' && !permission.includes(':view')) {
      return false;
    }

    if (delegation.delegationType === 'approval_only' && !permission.includes(':approve')) {
      return false;
    }

    // Check specific permissions if partial delegation
    if (delegation.delegationType === 'partial' && delegation.permissions) {
      if (!delegation.permissions.includes(permission)) {
        return false;
      }
    }

    // Check transaction amount limit
    if (
      delegation.maxTransactionAmount &&
      transactionAmount &&
      transactionAmount > delegation.maxTransactionAmount
    ) {
      return false;
    }

    return true;
  }

  /**
   * Log delegation usage
   */
  async logDelegationUsage(
    delegationId: string,
    delegateUserId: string,
    actionType: string,
    entityType: string | null,
    entityId: string | null,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    await (this.prisma as any).delegationUsageLog.create({
      data: {
        delegationId,
        delegateUserId,
        actionType,
        entityType,
        entityId,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Revoke a delegation
   */
  async revokeDelegation(delegationId: string, userId: string): Promise<void> {
    const delegation = await (this.prisma as any).userDelegation.findUnique({
      where: { id: delegationId },
      select: { delegatorUserId: true },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    // Only delegator or admin can revoke
    if (delegation.delegatorUserId !== userId) {
      throw new Error('Only the delegator can revoke this delegation');
    }

    await (this.prisma as any).userDelegation.update({
      where: { id: delegationId },
      data: { isActive: false },
    });
  }

  /**
   * Get delegation usage statistics
   */
  async getDelegationUsageStats(delegationId: string): Promise<any> {
    const logs = await (this.prisma as any).delegationUsageLog.findMany({
      where: { delegationId },
    });

    const actionBreakdown = logs.reduce((acc: any[], log: any) => {
      const existing = acc.find(item => item.action_type === log.actionType);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ action_type: log.actionType, count: 1 });
      }
      return acc;
    }, []);

    return {
      total_actions: logs.length,
      unique_action_types: new Set(logs.map((l: any) => l.actionType)).size,
      last_used_at: logs.length > 0 ? logs[logs.length - 1].createdAt : null,
      first_used_at: logs.length > 0 ? logs[0].createdAt : null,
      action_breakdown: actionBreakdown.sort((a: any, b: any) => b.count - a.count),
    };
  }

  /**
   * Get effective permissions for delegate (combining delegated permissions)
   */
  async getEffectivePermissions(
    delegateUserId: string,
    legalEntityId?: string,
  ): Promise<any[]> {
    const now = new Date();

    const delegations = await (this.prisma as any).userDelegation.findMany({
      where: {
        delegateUserId,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
        ...(legalEntityId && {
          OR: [
            { legalEntityId },
            { legalEntityId: null },
          ],
        }),
      },
      include: {
        delegator: { select: { firstName: true, lastName: true } },
      },
    });

    return delegations.map((d: any) => ({
      delegator_user_id: d.delegatorUserId,
      delegator_name: `${d.delegator.firstName} ${d.delegator.lastName}`,
      delegation_type: d.delegationType,
      permissions: d.permissions || [],
      effective_from: d.effectiveFrom,
      effective_to: d.effectiveTo,
    }));
  }

  /**
   * Auto-expire delegations
   */
  async autoExpireDelegations(): Promise<number> {
    const now = new Date();

    const result = await (this.prisma as any).userDelegation.updateMany({
      where: {
        isActive: true,
        effectiveTo: { not: null, lt: now },
      },
      data: { isActive: false },
    });

    return result.count;
  }
}
