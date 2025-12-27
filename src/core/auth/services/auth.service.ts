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
      user.passwordHash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if password needs rehashing
    if (this.passwordService.needsRehash(user.passwordHash)) {
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
    };

    const expiresIn = this.configService.get<string>('jwt.expiresIn');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn }),
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    // Store session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // 1 day

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        token: accessToken.substring(0, 50), // Store prefix for tracking
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.parseExpiration(expiresIn),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        organizationId: user.organizationId,
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
    const tokenPrefix = token.substring(0, 50);

    await this.prisma.userSession.deleteMany({
      where: {
        userId,
        token: tokenPrefix,
      },
    });

    this.logger.log(`User logged out: ${userId}`);
  }
}
