import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from './password.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { UserType } from '@prisma/client';
import * as crypto from 'crypto';
import {
  ALL_PERMISSIONS,
  WILDCARD_ALL,
  WILDCARD_ACTION,
} from '../permissions.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private passwordService: PasswordService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.passwordService.hashPassword(
      registerDto.password,
    );

    // Create user
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
    });

    this.logger.log(`User registered: ${user.email} (${user.id})`);

    // Generate tokens
    return this.generateAuthResponse(user);
  }

  /**
   * Login with email and password
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verifyPassword(
      user.passwordHash || '',
      loginDto.password,
    );

    if (!isPasswordValid) {
      this.logger.warn(`Failed login attempt for user: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if password needs rehashing
    if (user.passwordHash && this.passwordService.needsRehash(user.passwordHash)) {
      const newHash = await this.passwordService.hashPassword(loginDto.password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
      this.logger.log(`Rehashed password for user: ${user.id}`);
    }

    this.logger.log(`User logged in: ${user.email} (${user.id})`);

    // Generate tokens
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
   * Generate JWT tokens and auth response
   */
  private async generateAuthResponse(user: any): Promise<AuthResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      type: user.userType,
      organizationId: user.organizationId,
      jti: crypto.randomUUID(),
    };

    const expiresIn = this.configService.get<any>('jwt.expiresIn');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn }),
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get<any>('jwt.refreshExpiresIn'),
      }),
    ]);

    // Store session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // 1 day

    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        token: tokenHash, // Store hash for tracking
        expiresAt,
      },
    });

    // Fetch roles for the user to include in the response
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const roleNames = userWithRoles?.roles.map((ur: any) => ur.role.name) || [];
    const effectivePermissions = userWithRoles
      ? this.resolveEffectivePermissions(userWithRoles)
      : [];

    const supplierMembership = await this.prisma.supplierMembership.findFirst({
      where: { userId: user.id, isActive: true },
      select: { supplierId: true },
      orderBy: { assignedAt: 'asc' },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.parseExpiration(expiresIn!),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        organizationId: user.organizationId,
        supplierId: supplierMembership?.supplierId ?? null,
        roles: roleNames,
        effectivePermissions,
      },
    };
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
   *
   * Expands wildcards so the consumer (frontend, profile endpoint) can
   * do simple `includes()` checks without wildcard logic.
   *
   * - `*:*`         → expands to every permission in the catalog
   * - `resource:*`  → expands to every action on that resource
   * - explicit      → passed through as-is
   *
   * O(n) scan over catalog — acceptable for current size (~39 permissions).
   * Revisit if permission count grows beyond 500.
   */
  resolveEffectivePermissions(user: any): string[] {
    const rawPermissions = new Set<string>(
      user.roles.flatMap((ur: any) => ur.role.permissions || []),
    );

    // Full wildcard → return entire catalog
    if (rawPermissions.has(WILDCARD_ALL)) {
      return Array.from(ALL_PERMISSIONS);
    }

    const resolved = new Set<string>();

    for (const perm of rawPermissions) {
      if (perm.endsWith(`:${WILDCARD_ACTION}`)) {
        // Resource wildcard: expand to all actions for that resource
        const resource = perm.split(':')[0];
        for (const catalogPerm of ALL_PERMISSIONS) {
          if (catalogPerm.startsWith(`${resource}:`)) {
            resolved.add(catalogPerm);
          }
        }
      } else {
        resolved.add(perm);
      }
    }

    return Array.from(resolved);
  }
}
