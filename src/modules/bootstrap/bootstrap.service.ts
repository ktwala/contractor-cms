import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../../core/audit/audit.service';

@Injectable()
export class BootstrapService {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async getStatus(meta?: { ipAddress?: string; userAgent?: string }): Promise<{ bootstrap_required: boolean; user_count: number }> {
    const userCount = await this.prisma.user.count();
    await this.auditService.logBootstrapStatusChecked(meta);
    return {
      bootstrap_required: userCount === 0,
      user_count: userCount,
    };
  }

  async createFirstAdmin(
    params: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    },
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const role = await this.prisma.role.findUnique({
      where: { name: 'TENANT_ADMIN' },
    });
    if (!role) {
      throw new ConflictException(
        'TENANT_ADMIN role not found. Run npm run db:seed first.',
      );
    }

    const passwordHash = await bcrypt.hash(params.password, 10);

    const user = await this.prisma.$transaction(
      async (tx) => {
        const count = await tx.user.count();
        if (count > 0) {
          await this.auditService.logBootstrapAttemptAfterInitialization(meta);
          throw new ConflictException(
            'Bootstrap is only allowed when no users exist. Users already exist.',
          );
        }

        const created = await tx.user.create({
          data: {
            email: params.email,
            passwordHash,
            firstName: params.firstName,
            lastName: params.lastName,
            isActive: true,
          },
        });

        await tx.roleAssignment.create({
          data: {
            userId: created.id,
            roleId: role.id,
            scopeType: 'GLOBAL',
            legalEntityId: null,
          },
        });

        return created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      },
    );

    this.logger.log(`Bootstrap admin created: ${params.email}`);

    await this.auditService.logBootstrapAdminCreated({
      userId: user.id,
      adminEmail: params.email,
      source: 'bootstrap',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    const { roles, permissions, legalEntityAccess } =
      await this.authService.getUserContext(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions: Array.from(permissions),
      legalEntityAccess: Array.from(legalEntityAccess),
    };
    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.configService.get<string>('JWT_EXPIRATION', '24h');

    return {
      access_token: accessToken,
      expires_in: expiresIn,
      user: {
        user_id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        roles,
        permissions: Array.from(permissions),
        legal_entity_access: Array.from(legalEntityAccess),
      },
    };
  }
}
