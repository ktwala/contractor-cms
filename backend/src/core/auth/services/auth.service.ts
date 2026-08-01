import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from './password.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { UserType } from '@prisma/client';
import * as crypto from 'crypto';
import { expandEffectivePermissions } from '../utils/permission-evaluation';
import { TenantAuthorityService } from '../../authority/tenant-authority.service';
import { isResponsibleManagerAccountabilityInboxEnabled } from '../../config/responsible-manager-accountability.config';

const USER_AUTH_CONTEXT_INCLUDE = {
  roles: {
    include: {
      role: true,
    },
  },
  supplierMemberships: {
    where: { isActive: true },
    select: { supplierId: true, role: true, isActive: true },
    orderBy: { assignedAt: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.UserInclude;

type UserWithAuthContext = Prisma.UserGetPayload<{
  include: typeof USER_AUTH_CONTEXT_INCLUDE;
}>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private passwordService: PasswordService,
    private configService: ConfigService,
    private tenantAuthority: TenantAuthorityService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hashPassword(
      registerDto.password,
    );

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        userType: registerDto.userType || UserType.INTERNAL,
        organizationId: registerDto.organizationId,
        isActive: true,
        emailVerified: false,
      },
      include: USER_AUTH_CONTEXT_INCLUDE,
    });

    this.logger.log(`User registered: ${user.email} (${user.id})`);

    return this.generateAuthResponse(user);
  }

  /**
   * Login with email and password
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: USER_AUTH_CONTEXT_INCLUDE,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const isPasswordValid = await this.passwordService.verifyPassword(
      user.passwordHash || '',
      loginDto.password,
    );

    if (!isPasswordValid) {
      this.logger.warn(`Failed login attempt for user: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.passwordHash && this.passwordService.needsRehash(user.passwordHash)) {
      void this.rehashPasswordInBackground(user.id, loginDto.password);
    }

    this.logger.log(`User logged in: ${user.email} (${user.id})`);

    return this.generateAuthResponse(user);
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        organizationId: true,
        externalId: true,
        externalProvider: true,
        isActive: true,
        roles: {
          include: {
            role: true,
          },
        },
        supplierMemberships: {
          where: { isActive: true },
          select: { supplierId: true, role: true, isActive: true },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  /**
   * Profile payload for GET /auth/profile (and login response user envelope).
   */
  async buildProfileResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: string;
    organizationId: string | null;
    externalId?: string | null;
    externalProvider?: string | null;
    roles: Array<{
      roleId: string;
      organizationId: string | null;
      role: { name: string; permissions: string[] };
    }>;
    supplierMemberships?: Array<{
      supplierId: string;
      role?: string;
      isActive: boolean;
    }>;
  }) {
    const [effectivePermissions, tenantAuthority] = await Promise.all([
      Promise.resolve(this.resolveEffectivePermissions(user)),
      this.tenantAuthority.resolveForOrganization(user.organizationId),
    ]);

    const activeMembership = user.supplierMemberships?.find((m) => m.isActive);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      organizationId: user.organizationId,
      supplierId: activeMembership?.supplierId ?? null,
      externalId: user.externalId ?? null,
      externalProvider: user.externalProvider ?? null,
      roles: Array.from(
        new Map(
          user.roles.map((ur) => [
            `${ur.roleId}:${ur.organizationId ?? 'global'}`,
            {
              name: ur.role.name,
              permissions: ur.role.permissions,
              organizationId: ur.organizationId,
            },
          ]),
        ).values(),
      ),
      effectivePermissions,
      responsibleManagerAccountabilityInboxEnabled: isResponsibleManagerAccountabilityInboxEnabled(
        this.configService,
      ),
      tenantAuthority,
    };
  }

  /**
   * Generate JWT tokens and auth response
   */
  private async generateAuthResponse(
    user: UserWithAuthContext,
  ): Promise<AuthResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      type: user.userType,
      organizationId: user.organizationId,
      jti: crypto.randomUUID(),
    };

    const expiresIn = this.configService.get<any>('jwt.expiresIn');
    const refreshExpiresIn = this.configService.get<any>('jwt.refreshExpiresIn');

    const profilePromise = this.buildProfileResponse(user);

    const [accessToken, refreshToken, profile] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn }),
      this.jwtService.signAsync(payload, { expiresIn: refreshExpiresIn }),
      profilePromise,
    ]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    const roleNames = user.roles.map((ur) => ur.role.name);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.parseExpiration(expiresIn!),
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        userType: profile.userType,
        organizationId: profile.organizationId,
        supplierId: profile.supplierId,
        externalId: profile.externalId,
        roles: roleNames,
        effectivePermissions: profile.effectivePermissions,
        tenantAuthority: profile.tenantAuthority,
        responsibleManagerAccountabilityInboxEnabled:
          profile.responsibleManagerAccountabilityInboxEnabled,
      },
    };
  }

  private async rehashPasswordInBackground(
    userId: string,
    password: string,
  ): Promise<void> {
    try {
      const newHash = await this.passwordService.hashPassword(password);
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });
      this.logger.log(`Rehashed password for user: ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Background password rehash failed for user ${userId}: ${error}`,
      );
    }
  }

  /**
   * Parse expiration string to seconds
   */
  private parseExpiration(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);

    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60;
      case 'h':
        return value * 60 * 60;
      case 'm':
        return value * 60;
      default:
        return value;
    }
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(userId: string, token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await this.prisma.userSession.deleteMany({
      where: {
        userId,
        token: tokenHash,
      },
    });

    this.logger.log(`User logged out: ${userId}`);
  }

  /**
   * Resolve effective permissions from a user's roles.
   */
  resolveEffectivePermissions(user: {
    roles: Array<{ role: { permissions: string[] } }>;
  }): string[] {
    const rawPermissions = user.roles.flatMap(
      (ur) => ur.role.permissions || [],
    );
    return expandEffectivePermissions(rawPermissions);
  }
}
