import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AuditService } from '../../core/audit/audit.service';
import { isKnownPermission } from '../../core/auth/permissions.constants';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(createRoleDto: CreateRoleDto, actorUserId: string) {
    // Validate permissions against canonical catalog
    this.validatePermissions(createRoleDto.permissions);

    const role = await this.prisma.role.create({
      data: {
        name: createRoleDto.name,
        description: createRoleDto.description,
        permissions: createRoleDto.permissions,
        isSystemRole: false, // Enforced
      },
    });

    await this.auditService.logAction(
      actorUserId,
      'ROLE_CREATED',
      'Role',
      role.id,
      null,
      role,
    );

    return role;
  }

  async findAll() {
    return this.prisma.role.findMany();
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, actorUserId: string) {
    const existing = await this.findOne(id);

    if (existing.isSystemRole) {
      throw new ForbiddenException('Cannot edit a system role');
    }

    if (updateRoleDto.permissions) {
      this.validatePermissions(updateRoleDto.permissions);
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: updateRoleDto.name,
        description: updateRoleDto.description,
        permissions: updateRoleDto.permissions,
      },
    });

    await this.auditService.logAction(
      actorUserId,
      'ROLE_UPDATED',
      'Role',
      updated.id,
      existing,
      updated,
    );

    return updated;
  }

  async remove(id: string, actorUserId: string) {
    const existing = await this.findOne(id);

    if (existing.isSystemRole) {
      throw new ForbiddenException('Cannot delete a system role');
    }

    await this.prisma.role.delete({
      where: { id },
    });

    await this.auditService.logAction(
      actorUserId,
      'ROLE_DELETED',
      'Role',
      id,
      existing,
      null,
    );

    return { success: true };
  }

  private validatePermissions(permissions: string[]) {
    for (const perm of permissions) {
      if (!isKnownPermission(perm)) {
        throw new BadRequestException(`Unknown permission: ${perm}`);
      }
      if (perm === '*:*') {
        throw new BadRequestException(`Wildcard permission *:* is reserved for system admins only`);
      }
    }
  }
}
