import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import {
  assertRoleAssignmentAllowed,
  type RoleScopeType,
} from '../../../common/constants/rbac-role-policy';

export type UserListItem = {
  id: string;
  email: string;
  display_name: string;
  status: string;
};

export type UserDetail = {
  id: string;
  email: string;
  display_name: string;
  status: string;
};

export type RoleAssignmentItem = {
  role: string;
};

export type LegalEntityAssignment = {
  legal_entity_id: string;
  legal_entity_name: string;
  roles: string[];
};

export type RoleAssignmentsResponse = {
  global: RoleAssignmentItem[];
  legal_entities: LegalEntityAssignment[];
};

@Injectable()
export class UserManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(params: {
    q?: string;
    limit?: number;
    offset?: number;
    legal_entity_id?: string;
  }): Promise<{ items: UserListItem[]; total: number }> {
    const { q = '', limit = 50, offset = 0, legal_entity_id } = params;
    const search = q.trim().toLowerCase();

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (legal_entity_id) {
      where.roleAssignments = {
        some: {
          legalEntityId: legal_entity_id,
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
        orderBy: { email: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        status: u.isActive ? 'ACTIVE' : 'INACTIVE',
      })),
      total,
    };
  }

  async getUser(userId: string): Promise<UserDetail | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      display_name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
    };
  }

  async getRoleAssignments(userId: string): Promise<RoleAssignmentsResponse> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: { userId },
      include: {
        role: true,
        legalEntity: { select: { id: true, name: true } },
      },
    });

    const global: RoleAssignmentItem[] = [];
    const byEntity = new Map<string, { name: string; roles: string[] }>();

    for (const a of assignments) {
      const roleName = a.role.name;
      if (a.scopeType === 'GLOBAL') {
        global.push({ role: roleName });
      } else if (a.legalEntityId && a.legalEntity) {
        const existing = byEntity.get(a.legalEntityId);
        if (existing) {
          if (!existing.roles.includes(roleName)) existing.roles.push(roleName);
        } else {
          byEntity.set(a.legalEntityId, {
            name: a.legalEntity.name,
            roles: [roleName],
          });
        }
      }
    }

    return {
      global,
      legal_entities: Array.from(byEntity.entries()).map(([id, v]) => ({
        legal_entity_id: id,
        legal_entity_name: v.name,
        roles: v.roles,
      })),
    };
  }

  async assignRole(params: {
    userId: string;
    role: string;
    scope: 'GLOBAL' | 'LEGAL_ENTITY';
    legal_entity_id?: string;
  }): Promise<void> {
    const roleRecord = await this.prisma.role.findUnique({
      where: { name: params.role as any },
    });
    if (!roleRecord) {
      throw new BadRequestException(`Role not found: ${params.role}`);
    }

    const scopeType = (params.scope === 'GLOBAL' ? 'GLOBAL' : 'LEGAL_ENTITY') as RoleScopeType;
    const legalEntityId = params.scope === 'LEGAL_ENTITY' ? params.legal_entity_id ?? null : null;

    if (scopeType === 'LEGAL_ENTITY' && !legalEntityId) {
      throw new BadRequestException('legal_entity_id is required when scope is LEGAL_ENTITY');
    }

    let legalEntity: { id: string; country: string } | null = null;
    if (scopeType === 'LEGAL_ENTITY' && legalEntityId) {
      const le = await this.prisma.legalEntity.findUnique({
        where: { id: legalEntityId },
        select: { id: true, country: true },
      });
      if (!le) {
        throw new BadRequestException(`Legal entity not found: ${legalEntityId}`);
      }
      legalEntity = { id: le.id, country: le.country };
    }

    try {
      assertRoleAssignmentAllowed({
        role: params.role,
        scope: scopeType,
        legalEntity: scopeType === 'LEGAL_ENTITY' ? legalEntity : undefined,
      });
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid role assignment');
    }

    const existing = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: params.userId,
        roleId: roleRecord.id,
        scopeType,
        legalEntityId,
      },
    });
    if (existing) return;

    await this.prisma.roleAssignment.create({
      data: {
        userId: params.userId,
        roleId: roleRecord.id,
        scopeType,
        legalEntityId,
      },
    });
  }

  async removeRole(params: {
    userId: string;
    role: string;
    scope: 'GLOBAL' | 'LEGAL_ENTITY';
    legal_entity_id?: string;
    actorUserId: string;
  }): Promise<void> {
    const roleRecord = await this.prisma.role.findUnique({
      where: { name: params.role as any },
    });
    if (!roleRecord) {
      throw new BadRequestException(`Role not found: ${params.role}`);
    }

    const scopeType = params.scope === 'GLOBAL' ? 'GLOBAL' : 'LEGAL_ENTITY';
    const legalEntityId = params.scope === 'LEGAL_ENTITY' ? params.legal_entity_id ?? null : null;

    // Self-lockout protection
    if (params.actorUserId === params.userId) {
      if (params.role === 'PLATFORM_SUPERADMIN') {
        throw new BadRequestException(
          'You cannot remove PLATFORM_SUPERADMIN from yourself. Use another admin.',
        );
      }
      if (params.role === 'TENANT_ADMIN' && scopeType === 'GLOBAL') {
        const otherTenantAdmins = await this.prisma.roleAssignment.count({
          where: {
            scopeType: 'GLOBAL',
            roleId: roleRecord.id,
            userId: { not: params.userId },
          },
        });
        if (otherTenantAdmins === 0) {
          throw new BadRequestException(
            'You cannot remove your last TENANT_ADMIN role. Assign another tenant admin first.',
          );
        }
      }
    }

    const toDelete = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: params.userId,
        roleId: roleRecord.id,
        scopeType,
        ...(scopeType === 'LEGAL_ENTITY' && legalEntityId ? { legalEntityId } : { legalEntityId: null }),
      },
    });

    await this.prisma.roleAssignment.deleteMany({
      where: {
        userId: params.userId,
        roleId: roleRecord.id,
        scopeType,
        ...(scopeType === 'LEGAL_ENTITY' && legalEntityId ? { legalEntityId } : { legalEntityId: null }),
      },
    });

    if (toDelete) {
      await this.auditService.log({
        userId: params.actorUserId,
        action: 'ROLE_ASSIGNMENT_REMOVED',
        entityType: 'RoleAssignment',
        entityId: toDelete.id,
        oldValue: {
          userId: params.userId,
          role: params.role,
          scope: scopeType,
          legalEntityId,
        },
      });
    }
  }

  async getRoleTemplates(): Promise<{ name: string; description: string | null }[]> {
    return this.prisma.role.findMany({
      select: { name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }
}
