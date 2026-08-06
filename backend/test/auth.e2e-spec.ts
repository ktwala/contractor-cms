import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestHelper } from './utils/test-helper';

describe('Authentication & Authorization (Phase 1) E2E Tests', () => {
  let app: INestApplication;
  let organization: any;
  let user: any;
  let token: string;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
    organization = await TestHelper.createTestOrganization();
    user = await TestHelper.createUserWithRoles(organization.id, {
      email: 'test@example.com',
      password: 'Test123!@#',
      roles: [{ role: 'CMS_ADMIN', permissions: ['*:*'], orgId: null, isSystemRole: true }],
    });
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'NewUser123!@#',
        firstName: 'New',
        lastName: 'User',
        organizationId: organization.id,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        organizationId: registerDto.organizationId,
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should fail with duplicate email', async () => {
      const registerDto = {
        email: user.email,
        password: 'Test123!@#',
        firstName: 'Duplicate',
        lastName: 'User',
        organizationId: organization.id,
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(409);
    });

    it('should fail with weak password', async () => {
      const registerDto = {
        email: 'weak@example.com',
        password: 'weak',
        firstName: 'Weak',
        lastName: 'Password',
        organizationId: organization.id,
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'Test123!@#',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      expect(response.body.user).not.toHaveProperty('password');

      token = response.body.accessToken;
    });

    it('should fail with invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should fail with non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123!@#',
        })
        .expect(401);
    });

    it('should fail with inactive user', async () => {
      const inactiveUser = await TestHelper.createUserWithRoles(organization.id, {
        email: 'inactive@example.com',
        password: 'Test123!@#',
        isActive: false,
        roles: [{ role: 'CMS_ADMIN', permissions: ['*:*'], orgId: null, isSystemRole: true }],
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: inactiveUser.email,
          password: 'Test123!@#',
        })
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'Test123!@#',
        });
      token = loginResponse.body.accessToken;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      expect(response.body.roles[0]).toMatchObject({
        name: 'CMS_ADMIN',
      });
      expect(response.body).not.toHaveProperty('password');
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });

    it('should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Authorization - Permission Checks', () => {
    it('should allow access with correct permissions', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'Test123!@#',
        });
      token = loginResponse.body.accessToken;

      // User has suppliers:* permission via CMS_ADMIN *:*
      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should deny access without required permissions', async () => {
      const limitedUser = await TestHelper.createUserWithRoles(organization.id, {
        email: 'limited@example.com',
        password: 'Test123!@#',
        roles: [
          {
            role: 'CONTRACTOR_MANAGER',
            orgId: organization.id,
            permissions: ['contractors:read'],
            isSystemRole: true,
          },
        ],
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: limitedUser.email,
          password: 'Test123!@#',
        });
      const limitedToken = loginResponse.body.accessToken;

      // User doesn't have suppliers:read permission
      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(403);
    });
  });

  describe('PATCH /auth/profile', () => {
    it.skip('should update user profile [BACKLOG-IDENTITY-PROFILE-1]', async () => {});
  });

  describe('PATCH /auth/change-password', () => {
    it.skip('should change password [BACKLOG-IDENTITY-CREDENTIAL-1]', async () => {});
    it.skip('should fail password change with wrong current password [BACKLOG-IDENTITY-CREDENTIAL-1]', async () => {});
  });
});
