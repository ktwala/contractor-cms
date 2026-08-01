import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

interface Permission {
  permission_code: string;
  grant_type: 'allow' | 'deny';
  conditions?: any;
}

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a custom role
   */
  async createRole(
    roleName: string,
    roleCode: string,
    description: string,
    legalEntityId: string | null,
    parentRoleId: string | null,
    userId: string,
  ): Promise<string> {
    const role = await (this.prisma as any).enterpriseRole.create({
      data: {
        roleName,
        roleCode,
        description,
        legalEntityId,
        parentRoleId,
        roleType: 'custom',
        createdBy: userId,
      },
    });

    return role.id;
  }

  /**
   * Assign permissions to a role
   */
  async assignPermissionsToRole(
    roleId: string,
    permissions: Permission[],
    userId: string,
  ): Promise<void> {
    for (const permission of permissions) {
      // Get permission ID
      const perm = await (this.prisma as any).permission.findFirst({
        where: { code: permission.permission_code },
      });

      if (!perm) {
        console.warn(`Permission not found: ${permission.permission_code}`);
        continue;
      }

      const permissionId = perm.id;

      // Check if already assigned
      const existing = await (this.prisma as any).rolePermission.findFirst({
        where: { roleId, permissionId },
      });

      if (existing) {
        // Update existing
        await (this.prisma as any).rolePermission.update({
          where: { id: existing.id },
          data: {
            grantType: permission.grant_type,
            conditions: permission.conditions || null,
          },
        });
      } else {
        // Insert new
        await (this.prisma as any).rolePermission.create({
          data: {
            roleId,
            permissionId,
            grantType: permission.grant_type,
            conditions: permission.conditions || null,
            createdBy: userId,
          },
        });
      }
    }

    // Update cached permissions on role
    await this.updateRolePermissionCache(roleId);
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    legalEntityId: string | null,
    departmentId: string | null,
    effectiveFrom: string,
    effectiveTo: string | null,
    assignedBy: string,
  ): Promise<string> {
    const assignment = await (this.prisma as any).userRoleAssignment.create({
      data: {
        userId,
        roleId,
        legalEntityId,
        departmentId,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        assignedBy,
      },
    });

    return assignment.id;
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: string,
    permissionCode: string,
    legalEntityId?: string,
  ): Promise<boolean> {
    const now = new Date();

    // Get all active roles for user
    const whereClause: any = {
      userId,
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: now } },
      ],
    };

    if (legalEntityId) {
      whereClause.OR = [
        { legalEntityId },
        { legalEntityId: null },
      ];
    }

    const assignments = await (this.prisma as any).userRoleAssignment.findMany({
      where: whereClause,
      include: {
        role: true,
      },
    });

    if (assignments.length === 0) {
      return false;
    }

    // Check each role for the permission
    for (const assignment of assignments) {
      const hasPermission = await this.checkRolePermission(
        assignment.roleId,
        permissionCode,
        assignment.role.parentRoleId,
      );
      if (hasPermission) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string, legalEntityId?: string): Promise<string[]> {
    const now = new Date();

    const whereClause: any = {
      userId,
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: now } },
      ],
    };

    if (legalEntityId) {
      whereClause.OR = [
        { legalEntityId },
        { legalEntityId: null },
      ];
    }

    const assignments = await (this.prisma as any).userRoleAssignment.findMany({
      where: whereClause,
      include: {
        role: {
          include: {
            rolePermissions: {
              where: { grantType: 'allow' },
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();
    for (const assignment of assignments) {
      for (const rp of assignment.role.rolePermissions) {
        permissions.add(rp.permission.permissionCode);
      }
    }

    return Array.from(permissions).sort();
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(userId: string): Promise<any[]> {
    const assignments = await (this.prisma as any).userRoleAssignment.findMany({
      where: { userId },
      include: {
        role: true,
        legalEntity: { select: { entityName: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return assignments.map((a: any) => ({
      id: a.role.id,
      role_name: a.role.roleName,
      role_code: a.role.roleCode,
      description: a.role.description,
      legal_entity_id: a.legalEntityId,
      legal_entity_name: a.legalEntity?.entityName || null,
      effective_from: a.effectiveFrom,
      effective_to: a.effectiveTo,
      is_active: a.isActive,
    }));
  }

  /**
   * Get all available permissions
   */
  async getAllPermissions(category?: string): Promise<any[]> {
    return (this.prisma as any).permission.findMany({
      orderBy: [{ code: 'asc' }],
    });
  }

  /**
   * Get role details with permissions
   */
  async getRoleDetails(roleId: string): Promise<any> {
    const role = await (this.prisma as any).enterpriseRole.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    return {
      ...role,
      permissions: role.rolePermissions.map((rp: any) => ({
        permission_code: rp.permission.permissionCode,
        permission_name: rp.permission.permissionName,
        resource_type: rp.permission.resourceType,
        action: rp.permission.action,
        grant_type: rp.grantType,
        conditions: rp.conditions,
      })),
    };
  }

  /**
   * Check if a specific role has a permission (with inheritance)
   */
  private async checkRolePermission(
    roleId: string,
    permissionCode: string,
    parentRoleId: string | null,
  ): Promise<boolean> {
    // Check direct permissions
    const rolePermission = await (this.prisma as any).rolePermission.findFirst({
      where: {
        roleId,
        permission: { permissionCode },
      },
    });

    if (rolePermission) {
      return rolePermission.grantType === 'allow';
    }

    // Check parent role if exists (role inheritance)
    if (parentRoleId) {
      const parentRole = await (this.prisma as any).enterpriseRole.findUnique({
        where: { id: parentRoleId },
        select: { parentRoleId: true },
      });

      if (parentRole) {
        return this.checkRolePermission(
          parentRoleId,
          permissionCode,
          parentRole.parentRoleId,
        );
      }
    }

    return false;
  }

  /**
   * Update the cached permissions on a role
   */
  private async updateRolePermissionCache(roleId: string): Promise<void> {
    const rolePermissions = await (this.prisma as any).rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });

    const permissionCache = rolePermissions.reduce((acc: any, rp: any) => {
      acc[rp.permission.permissionCode] = rp.grantType;
      return acc;
    }, {});

    await (this.prisma as any).enterpriseRole.update({
      where: { id: roleId },
      data: { permissions: permissionCache },
    });
  }

  /**
   * Revoke role from user
   */
  async revokeRoleFromUser(assignmentId: string): Promise<void> {
    await (this.prisma as any).userRoleAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false },
    });
  }

  /**
   * Create a permission
   */
  async createPermission(
    permissionCode: string,
    permissionName: string,
    resourceType: string,
    action: string,
    description: string,
    category: string,
  ): Promise<string> {
    const permission = await (this.prisma as any).permission.create({
      data: {
        code: permissionCode,
        name: permissionName,
        resourceType,
        action,
        description,
      },
    });

    return permission.id;
  }
}
