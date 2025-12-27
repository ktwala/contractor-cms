import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
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
    user = await TestHelper.createTestUser(organization.id, {
      email: 'test@example.com',
      password: 'Test123!@#',
    });
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  describe('POST /auth/register', () => {
    it('should register a new user and organization', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'NewUser123!@#',
        firstName: 'New',
        lastName: 'User',
        organizationName: 'New Organization',
        organizationCode: `NEWORG-${Date.now()}`,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toMatchObject({
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.organization).toMatchObject({
        name: registerDto.organizationName,
        code: registerDto.organizationCode,
      });
    });

    it('should fail with duplicate email', async () => {
      const registerDto = {
        email: user.email,
        password: 'Test123!@#',
        firstName: 'Duplicate',
        lastName: 'User',
        organizationName: 'Duplicate Org',
        organizationCode: `DUP-${Date.now()}`,
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });

    it('should fail with weak password', async () => {
      const registerDto = {
        email: 'weak@example.com',
        password: 'weak',
        firstName: 'Weak',
        lastName: 'Password',
        organizationName: 'Weak Org',
        organizationCode: `WEAK-${Date.now()}`,
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

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toMatchObject({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      expect(response.body.user).not.toHaveProperty('password');

      token = response.body.access_token;
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
      const inactiveUser = await TestHelper.createTestUser(organization.id, {
        email: 'inactive@example.com',
        password: 'Test123!@#',
        status: 'INACTIVE',
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
      token = loginResponse.body.access_token;
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
        role: user.role,
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
      token = loginResponse.body.access_token;

      // User has suppliers:* permission
      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should deny access without required permissions', async () => {
      const limitedUser = await TestHelper.createTestUser(organization.id, {
        email: 'limited@example.com',
        password: 'Test123!@#',
        permissions: ['contractors:read'],
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: limitedUser.email,
          password: 'Test123!@#',
        });
      const limitedToken = loginResponse.body.access_token;

      // User doesn't have suppliers:read permission
      await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(403);
    });
  });

  describe('PATCH /auth/profile', () => {
    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'Test123!@#',
        });
      token = loginResponse.body.access_token;
    });

    it('should update user profile', async () => {
      const updateDto = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const response = await request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toMatchObject(updateDto);
    });

    it('should change password', async () => {
      const changePasswordDto = {
        currentPassword: 'Test123!@#',
        newPassword: 'NewPassword123!@#',
      };

      await request(app.getHttpServer())
        .patch('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(changePasswordDto)
        .expect(200);

      // Verify new password works
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: changePasswordDto.newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('access_token');
    });

    it('should fail password change with wrong current password', async () => {
      const changePasswordDto = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!@#',
      };

      await request(app.getHttpServer())
        .patch('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(changePasswordDto)
        .expect(401);
    });
  });
});
