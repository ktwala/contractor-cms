import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { AuditService } from '../../core/audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(createUserDto: CreateUserDto, actorUserId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        userType: createUserDto.userType,
        isActive: true,
        emailVerified: false,
      },
    });

    await this.auditService.logAction(
      actorUserId,
      'USER_CREATED',
      'User',
      user.id,
      null,
      user,
    );

    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, actorUserId: string) {
    const existing = await this.findOne(id);

    // Protection: Cannot deactivate last active CMS_ADMIN
    if (updateUserDto.isActive === false && existing.isActive === true) {
      const isCmsAdmin = existing.roles.some((ur) => ur.role.name === 'CMS_ADMIN');
      if (isCmsAdmin) {
        await this.ensureNotLastCmsAdmin(id);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: updateUserDto.email,
        firstName: updateUserDto.firstName,
        lastName: updateUserDto.lastName,
        userType: updateUserDto.userType,
        isActive: updateUserDto.isActive,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    await this.auditService.logAction(
      actorUserId,
      updateUserDto.isActive === false ? 'USER_DEACTIVATED' : 'USER_UPDATED',
      'User',
      updated.id,
      existing,
      updated,
    );

    return updated;
  }

  /**
   * Replace all roles for a user
   */
  async assignRoles(id: string, assignRolesDto: AssignRolesDto, actorUserId: string) {
    const user = await this.findOne(id);
    const roleIds = assignRolesDto.roleIds;

    // Verify all requested roles exist
    const requestedRoles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    if (requestedRoles.length !== roleIds.length) {
      throw new BadRequestException('One or more invalid role IDs provided');
    }

    const wasCmsAdmin = user.roles.some((ur) => ur.role.name === 'CMS_ADMIN');
    const willBeCmsAdmin = requestedRoles.some((r) => r.name === 'CMS_ADMIN');

    // Protection: Cannot remove CMS_ADMIN from last active CMS_ADMIN
    if (wasCmsAdmin && !willBeCmsAdmin && user.isActive) {
      await this.ensureNotLastCmsAdmin(user.id);
    }

    // Replace roles in transaction
    const results = await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({
        where: { userId: user.id },
      }),
      ...roleIds.map((roleId) =>
        this.prisma.userRole.create({
          data: {
            userId: user.id,
            roleId,
            assignedBy: actorUserId,
          },
        })
      ),
      this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
          roles: { include: { role: true } },
        },
      }),
    ]);

    const updatedUser = results[results.length - 1] as any;

    await this.auditService.logAction(
      actorUserId,
      'USER_ROLES_REPLACED',
      'User',
      user.id,
      { roles: user.roles },
      { roles: updatedUser.roles },
    );

    return updatedUser;
  }

  /**
   * Add roles to a user without removing existing
   */
  async addRoles(id: string, assignRolesDto: AssignRolesDto, actorUserId: string) {
    const user = await this.findOne(id);
    const roleIds = assignRolesDto.roleIds;

    const requestedRoles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    if (requestedRoles.length !== roleIds.length) {
      throw new BadRequestException('One or more invalid role IDs provided');
    }

    const existingRoleIds = new Set(user.roles.map((ur) => ur.roleId));
    const newRoleIds = roleIds.filter((id) => !existingRoleIds.has(id));

    if (newRoleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: newRoleIds.map((roleId) => ({
          userId: user.id,
          roleId,
          assignedBy: actorUserId,
        })),
      });

      await this.auditService.logAction(
        actorUserId,
        'USER_ROLES_ADDED',
        'User',
        user.id,
        { roleIds: Array.from(existingRoleIds) },
        { addedRoleIds: newRoleIds },
      );
    }

    return this.findOne(id);
  }

  /**
   * Remove a single role from a user
   */
  async removeRole(id: string, roleId: string, actorUserId: string) {
    const user = await this.findOne(id);
    const userRole = user.roles.find((ur) => ur.roleId === roleId);

    if (!userRole) {
      return user; // Nothing to remove
    }

    const isCmsAdmin = userRole.role.name === 'CMS_ADMIN';
    if (isCmsAdmin && user.isActive) {
      await this.ensureNotLastCmsAdmin(user.id);
    }

    await this.prisma.userRole.delete({
      where: { id: userRole.id },
    });

    await this.auditService.logAction(
      actorUserId,
      'USER_ROLE_REMOVED',
      'User',
      user.id,
      { removedRoleId: roleId },
      null,
    );

    return this.findOne(id);
  }

  private async ensureNotLastCmsAdmin(userId: string) {
    // Count how many ACTIVE users have the CMS_ADMIN role, excluding the current user
    const otherAdminCount = await this.prisma.userRole.count({
      where: {
        userId: { not: userId },
        role: { name: 'CMS_ADMIN' },
        user: { isActive: true },
      },
    });

    if (otherAdminCount === 0) {
      throw new ConflictException(
        'Cannot perform this action: this is the last active CMS_ADMIN in the system.',
      );
    }
  }
}
