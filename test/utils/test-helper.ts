import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/database/prisma.service';
import * as request from 'supertest';

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
    await this.prisma.invoice.deleteMany();
    await this.prisma.timesheet.deleteMany();
    await this.prisma.engagement.deleteMany();
    await this.prisma.contract.deleteMany();
    await this.prisma.contractorTaxClassification.deleteMany();
    await this.prisma.contractor.deleteMany();
    await this.prisma.supplier.deleteMany();
    await this.prisma.project.deleteMany();
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

  static async createTestOrganization(data?: Partial<any>): Promise<any> {
    return this.prisma.organization.create({
      data: {
        name: data?.name || 'Test Organization',
        code: data?.code || `TEST-${Date.now()}`,
        country: data?.country || 'ZA',
        currency: data?.currency || 'ZAR',
        timezone: data?.timezone || 'Africa/Johannesburg',
        ...data,
      },
    });
  }

  static async createTestUser(
    organizationId: string,
    data?: Partial<any>,
  ): Promise<any> {
    const argon2 = require('argon2');
    const hashedPassword = await argon2.hash(data?.password || 'Test123!@#');

    return this.prisma.user.create({
      data: {
        organizationId,
        email: data?.email || `test-${Date.now()}@example.com`,
        password: hashedPassword,
        firstName: data?.firstName || 'Test',
        lastName: data?.lastName || 'User',
        role: data?.role || 'ADMIN',
        permissions: data?.permissions || [
          'suppliers:*',
          'contractors:*',
          'contracts:*',
          'engagements:*',
          'timesheets:*',
          'invoices:*',
          'projects:*',
          'withholding:*',
          'analytics:*',
          'organizations:*',
        ],
        status: data?.status || 'ACTIVE',
      },
    });
  }

  static async login(
    email: string = 'test@example.com',
    password: string = 'Test123!@#',
  ): Promise<{ token: string; user: any }> {
    const response = await request(this.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    this.authToken = response.body.access_token;
    this.userId = response.body.user.id;
    this.organizationId = response.body.user.organizationId;

    return {
      token: response.body.access_token,
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

  static async setupTestData(): Promise<{
    organization: any;
    user: any;
    token: string;
  }> {
    const organization = await this.createTestOrganization();
    const user = await this.createTestUser(organization.id);
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
