import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/database/prisma.service';
import request from 'supertest';

/**
 * Test helper — role-centric user creation matching the actual Prisma schema.
 *
 * Users are created with `passwordHash` (not `password`), roles via `UserRole`
 * join table (not inline `role`/`permissions`), and `isActive` (not `status`).
 */
export class TestHelper {
  private static app: INestApplication;
  private static prisma: PrismaService;
  private static authToken: string;
  private static organizationId: string;
  private static userId: string;

  static async setupTestApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();

    // Apply global pipes (same as main.ts)
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await this.app.init();

    this.prisma = this.app.get(PrismaService);

    return this.app;
  }

  static async cleanupDatabase(): Promise<void> {
    if (!this.prisma) {
      return;
    }

    // Delete in correct order to respect foreign key constraints
    await this.prisma.withholdingInstruction.deleteMany();
    await this.prisma.invoiceLineItem.deleteMany();
    await this.prisma.invoice.deleteMany();
    await this.prisma.timesheetEntry.deleteMany();
    await this.prisma.timesheet.deleteMany();
    await this.prisma.contractorEngagement.deleteMany();
    await this.prisma.supplierContract.deleteMany();
    await this.prisma.contractorTaxClassification.deleteMany();
    await this.prisma.supplierDocument.deleteMany();
    await this.prisma.contractor.deleteMany();
    await this.prisma.supplier.deleteMany();
    await this.prisma.task.deleteMany();
    await this.prisma.project.deleteMany();
    await this.prisma.igaOutboxEvent.deleteMany();
    await this.prisma.userRole.deleteMany();
    await this.prisma.role.deleteMany();
    await this.prisma.userSession.deleteMany();
    await this.prisma.apiKey.deleteMany();
    await this.prisma.user.deleteMany();
    await this.prisma.organization.deleteMany();
  }

  static async closeApp(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }

  static getApp(): INestApplication {
    return this.app;
  }

  static getPrisma(): PrismaService {
    return this.prisma;
  }

  // ---------------------------------------------------------------------------
  // Organization helpers
  // ---------------------------------------------------------------------------

  private static orgCounter = 0;

  static async createTestOrganization(data?: Partial<any>): Promise<any> {
    TestHelper.orgCounter++;
    return this.prisma.organization.create({
      data: {
        name: data?.name || 'Test Organization',
        code: data?.code || `TEST-${Date.now()}-${TestHelper.orgCounter}-${Math.random().toString(36).slice(2, 6)}`,
        country: data?.country || 'ZA',
        currency: data?.currency || 'ZAR',
        timezone: data?.timezone || 'Africa/Johannesburg',
        ...data,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Role helpers
  // ---------------------------------------------------------------------------

  /**
   * Create a role with explicit permissions.
   */
  static async createTestRole(
    name: string,
    permissions: string[],
    isSystemRole = false,
    description?: string,
  ): Promise<any> {
    return this.prisma.role.upsert({
      where: { name },
      update: { permissions, isSystemRole },
      create: {
        name,
        description: description || `Test role: ${name}`,
        permissions,
        isSystemRole,
      },
    });
  }

  /**
   * Assign a role to a user, optionally scoped to an organization.
   */
  static async assignRole(
    userId: string,
    roleId: string,
    organizationId: string | null = null,
    assignedBy = 'test-system',
  ): Promise<any> {
    // Prisma can't use null in composite unique where clause,
    // so for global roles (null organizationId) use findFirst + create
    if (organizationId === null) {
      const existing = await this.prisma.userRole.findFirst({
        where: { userId, roleId, organizationId: null },
      });
      if (existing) return existing;
      return this.prisma.userRole.create({
        data: { userId, roleId, organizationId: null, assignedBy },
      });
    }

    return this.prisma.userRole.upsert({
      where: {
        userId_roleId_organizationId: {
          userId,
          roleId,
          organizationId,
        },
      },
      update: {},
      create: {
        userId,
        roleId,
        organizationId,
        assignedBy,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // User helpers
  // ---------------------------------------------------------------------------

  /**
   * Create a test user — no roles attached.
   * Use `createUserWithRoles()` for the common case.
   */
  static async createTestUser(
    organizationId: string | null,
    data?: Partial<any>,
  ): Promise<any> {
    const argon2 = require('argon2');
    const hashedPassword = await argon2.hash(data?.password || 'Test123!@#');

    return this.prisma.user.create({
      data: {
        organizationId,
        email: data?.email || `test-${Date.now()}@example.com`,
        passwordHash: hashedPassword,
        firstName: data?.firstName || 'Test',
        lastName: data?.lastName || 'User',
        userType: data?.userType || 'INTERNAL',
        isActive: data?.isActive !== undefined ? data.isActive : true,
        emailVerified: data?.emailVerified !== undefined ? data.emailVerified : true,
      },
    });
  }

  /**
   * Create a user and assign one or more roles — the standard test setup.
   *
   * Usage:
   * ```ts
   * const user = await TestHelper.createUserWithRoles(orgId, {
   *   email: 'finance@test.com',
   *   roles: [
   *     { role: 'FINANCE_USER' },
   *     { role: 'CONTRACTOR_MANAGER', orgId: 'specific-org' },
   *   ],
   * });
   * ```
   */
  static async createUserWithRoles(
    organizationId: string | null,
    data: {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      userType?: string;
      isActive?: boolean;
      roles: Array<{
        role: string;
        permissions?: string[];
        orgId?: string | null;
        isSystemRole?: boolean;
      }>;
    },
  ): Promise<any> {
    const user = await this.createTestUser(organizationId, data);

    for (const roleSpec of data.roles) {
      // Create or upsert the role
      const role = await this.createTestRole(
        roleSpec.role,
        roleSpec.permissions || [],
        roleSpec.isSystemRole || false,
      );

      // Assign role to user
      await this.assignRole(
        user.id,
        role.id,
        roleSpec.orgId !== undefined ? roleSpec.orgId : organizationId,
      );
    }

    return user;
  }

  // ---------------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------------

  static async login(
    email: string = 'test@example.com',
    password: string = 'Test123!@#',
  ): Promise<{ token: string; user: any }> {
    const response = await request(this.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    this.authToken = response.body.accessToken;
    this.userId = response.body.user.id;
    this.organizationId = response.body.user.organizationId;

    return {
      token: response.body.accessToken,
      user: response.body.user,
    };
  }

  static getAuthToken(): string {
    return this.authToken;
  }

  static getUserId(): string {
    return this.userId;
  }

  static getOrganizationId(): string {
    return this.organizationId;
  }

  /**
   * Convenience: create org + user with roles + login in one call.
   */
  static async setupTestData(
    roles: Array<{
      role: string;
      permissions?: string[];
      orgId?: string | null;
      isSystemRole?: boolean;
    }> = [{ role: 'CMS_ADMIN', permissions: ['*:*'], isSystemRole: true }],
  ): Promise<{
    organization: any;
    user: any;
    token: string;
  }> {
    const organization = await this.createTestOrganization();
    const user = await this.createUserWithRoles(organization.id, {
      email: 'test@example.com',
      roles,
    });
    const { token } = await this.login(user.email);

    return { organization, user, token };
  }

  static authenticatedRequest(
    token?: string,
  ): request.SuperTest<request.Test> {
    const agent = request(this.app.getHttpServer());
    const authToken = token || this.authToken;

    if (authToken) {
      return agent.set('Authorization', `Bearer ${authToken}`) as any;
    }

    return agent as any;
  }
}
