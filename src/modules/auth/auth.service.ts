import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async login(email: string, password: string) {
    // Find user by email - simplified query to avoid relation issues
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Login attempt with non-existent email: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      this.logger.warn(`Login attempt with inactive user: ${email}`);
      throw new UnauthorizedException('User account is inactive');
    }

    // Verify password
    const isPasswordValid = await this.validatePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password attempt for user: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Build context from RoleAssignment (RBAC v1.1)
    const { roles, permissions, legalEntityAccess, hasGlobalScope } = await this.getUserContext(user.id);

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions: Array.from(permissions),
      legalEntityAccess: Array.from(legalEntityAccess),
      hasGlobalScope,
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.configService.get<string>('JWT_EXPIRATION', '24h');

    this.logger.log(`Successful login for user: ${email} (${roles.join(', ')})`);

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

  /**
   * Build user context from RoleAssignment (RBAC v1.1). Legacy UserRole / UserLegalEntityAccess are deprecated.
   * Used by login, getCurrentUser, and JwtStrategy.
   */
  async getUserContext(userId: string): Promise<{
    roles: string[];
    permissions: Set<string>;
    legalEntityAccess: Set<string>;
    hasGlobalScope: boolean;
  }> {
    const roleAssignments = await this.prisma.roleAssignment.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const roles: string[] = [];
    const permissions = new Set<string>();
    const legalEntityAccess = new Set<string>();
    let hasGlobalScope = false;

    for (const ra of roleAssignments) {
      roles.push(ra.role.name);
      for (const rp of ra.role.permissions) {
        permissions.add(rp.permission.code);
      }
      if (ra.scopeType === 'GLOBAL') {
        hasGlobalScope = true;
        const allEntities = await this.prisma.legalEntity.findMany({
          select: { id: true },
        });
        allEntities.forEach((le) => legalEntityAccess.add(le.id));
      } else if (ra.legalEntityId) {
        legalEntityAccess.add(ra.legalEntityId);
      }
    }

    return { roles, permissions, legalEntityAccess, hasGlobalScope };
  }

  async validatePassword(password: string, hash: string): Promise<boolean> {
    try {
      // Check if hash is a valid bcrypt hash
      if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$') && !hash.startsWith('$2y$')) {
        // If it's not a bcrypt hash (e.g., placeholder), return false
        this.logger.warn('Password hash is not a valid bcrypt hash');
        return false;
      }
      return await bcrypt.compare(password, hash);
    } catch (error) {
      this.logger.error('Error validating password', error);
      return false;
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const { roles, permissions, legalEntityAccess, hasGlobalScope } = await this.getUserContext(userId);

    return {
      user_id: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      roles,
      permissions: Array.from(permissions),
      legal_entity_access: Array.from(legalEntityAccess),
      has_global_scope: hasGlobalScope,
    };
  }
}
