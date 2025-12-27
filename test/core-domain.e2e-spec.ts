import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelper } from './utils/test-helper';
import { DataFactory } from './fixtures/data-factory';

describe('Core Domain (Phase 2) E2E Tests', () => {
  let app: INestApplication;
  let organization: any;
  let user: any;
  let token: string;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
    const setup = await TestHelper.setupTestData();
    organization = setup.organization;
    user = setup.user;
    token = setup.token;
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  describe('Suppliers Module', () => {
    describe('POST /suppliers', () => {
      it('should create a supplier', async () => {
        const supplierDto = DataFactory.supplier();

        const response = await request(app.getHttpServer())
          .post('/suppliers')
          .set('Authorization', `Bearer ${token}`)
          .send(supplierDto)
          .expect(201);

        expect(response.body).toMatchObject({
          type: supplierDto.type,
          firstName: supplierDto.firstName,
          lastName: supplierDto.lastName,
          email: supplierDto.email,
          status: supplierDto.status,
        });
        expect(response.body).toHaveProperty('id');
        expect(response.body.organizationId).toBe(organization.id);
      });

      it('should create a company supplier', async () => {
        const supplierDto = DataFactory.supplier({
          type: 'COMPANY',
          companyName: 'Test Company Ltd',
          registrationNumber: 'REG123456',
        });

        const response = await request(app.getHttpServer())
          .post('/suppliers')
          .set('Authorization', `Bearer ${token}`)
          .send(supplierDto)
          .expect(201);

        expect(response.body.type).toBe('COMPANY');
        expect(response.body.companyName).toBe('Test Company Ltd');
      });
    });

    describe('GET /suppliers', () => {
      it('should list suppliers with pagination', async () => {
        // Create 3 suppliers
        for (let i = 0; i < 3; i++) {
          await TestHelper.getPrisma().supplier.create({
            data: {
              organizationId: organization.id,
              ...DataFactory.supplier({ email: `supplier${i}@example.com` }),
            },
          });
        }

        const response = await request(app.getHttpServer())
          .get('/suppliers?page=1&limit=2')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.total).toBe(3);
        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(2);
      });

      it('should filter suppliers by status', async () => {
        await TestHelper.getPrisma().supplier.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.supplier({ status: 'ACTIVE' }),
          },
        });
        await TestHelper.getPrisma().supplier.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.supplier({ status: 'INACTIVE', email: 'inactive@example.com' }),
          },
        });

        const response = await request(app.getHttpServer())
          .get('/suppliers?status=ACTIVE')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((s: any) => s.status === 'ACTIVE')).toBe(true);
      });
    });

    describe('GET /suppliers/:id', () => {
      it('should get supplier by id', async () => {
        const supplier = await TestHelper.getPrisma().supplier.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.supplier(),
          },
        });

        const response = await request(app.getHttpServer())
          .get(`/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.id).toBe(supplier.id);
        expect(response.body.email).toBe(supplier.email);
      });

      it('should return 404 for non-existent supplier', async () => {
        await request(app.getHttpServer())
          .get('/suppliers/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${token}`)
          .expect(404);
      });
    });

    describe('PATCH /suppliers/:id', () => {
      it('should update supplier', async () => {
        const supplier = await TestHelper.getPrisma().supplier.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.supplier(),
          },
        });

        const updateDto = {
          firstName: 'Updated',
          phone: '+27829999999',
        };

        const response = await request(app.getHttpServer())
          .patch(`/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.firstName).toBe(updateDto.firstName);
        expect(response.body.phone).toBe(updateDto.phone);
      });
    });

    describe('DELETE /suppliers/:id', () => {
      it('should delete supplier', async () => {
        const supplier = await TestHelper.getPrisma().supplier.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.supplier(),
          },
        });

        await request(app.getHttpServer())
          .delete(`/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(204);

        // Verify deletion
        const deleted = await TestHelper.getPrisma().supplier.findUnique({
          where: { id: supplier.id },
        });
        expect(deleted).toBeNull();
      });
    });
  });

  describe('Contractors Module', () => {
    let supplier: any;

    beforeEach(async () => {
      supplier = await TestHelper.getPrisma().supplier.create({
        data: {
          organizationId: organization.id,
          ...DataFactory.supplier(),
        },
      });
    });

    describe('POST /contractors', () => {
      it('should create a contractor', async () => {
        const contractorDto = DataFactory.contractor(supplier.id);

        const response = await request(app.getHttpServer())
          .post('/contractors')
          .set('Authorization', `Bearer ${token}`)
          .send(contractorDto)
          .expect(201);

        expect(response.body).toMatchObject({
          supplierId: supplier.id,
          firstName: contractorDto.firstName,
          lastName: contractorDto.lastName,
          email: contractorDto.email,
          status: contractorDto.status,
        });
      });

      it('should fail with non-existent supplier', async () => {
        const contractorDto = DataFactory.contractor('00000000-0000-0000-0000-000000000000');

        await request(app.getHttpServer())
          .post('/contractors')
          .set('Authorization', `Bearer ${token}`)
          .send(contractorDto)
          .expect(404);
      });
    });

    describe('GET /contractors', () => {
      it('should list contractors', async () => {
        // Create 2 contractors
        for (let i = 0; i < 2; i++) {
          await TestHelper.getPrisma().contractor.create({
            data: DataFactory.contractor(supplier.id, {
              email: `contractor${i}@example.com`,
            }),
          });
        }

        const response = await request(app.getHttpServer())
          .get('/contractors')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter by supplier', async () => {
        const contractor = await TestHelper.getPrisma().contractor.create({
          data: DataFactory.contractor(supplier.id),
        });

        const response = await request(app.getHttpServer())
          .get(`/contractors?supplierId=${supplier.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((c: any) => c.supplierId === supplier.id)).toBe(true);
      });
    });

    describe('PATCH /contractors/:id', () => {
      it('should update contractor', async () => {
        const contractor = await TestHelper.getPrisma().contractor.create({
          data: DataFactory.contractor(supplier.id),
        });

        const updateDto = {
          status: 'INACTIVE',
        };

        const response = await request(app.getHttpServer())
          .patch(`/contractors/${contractor.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.status).toBe('INACTIVE');
      });
    });
  });

  describe('Contracts Module', () => {
    let supplier: any;
    let contractor: any;

    beforeEach(async () => {
      supplier = await TestHelper.getPrisma().supplier.create({
        data: {
          organizationId: organization.id,
          ...DataFactory.supplier(),
        },
      });
      contractor = await TestHelper.getPrisma().contractor.create({
        data: DataFactory.contractor(supplier.id),
      });
    });

    describe('POST /contracts', () => {
      it('should create a contract', async () => {
        const contractDto = DataFactory.contract(contractor.id, supplier.id);

        const response = await request(app.getHttpServer())
          .post('/contracts')
          .set('Authorization', `Bearer ${token}`)
          .send(contractDto)
          .expect(201);

        expect(response.body).toMatchObject({
          contractorId: contractor.id,
          supplierId: supplier.id,
          title: contractDto.title,
          type: contractDto.type,
          status: contractDto.status,
        });
        expect(response.body.organizationId).toBe(organization.id);
      });

      it('should validate date range', async () => {
        const contractDto = DataFactory.contract(contractor.id, supplier.id, {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() - 1000).toISOString(), // End before start
        });

        await request(app.getHttpServer())
          .post('/contracts')
          .set('Authorization', `Bearer ${token}`)
          .send(contractDto)
          .expect(400);
      });
    });

    describe('GET /contracts', () => {
      it('should list contracts', async () => {
        await TestHelper.getPrisma().contract.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.contract(contractor.id, supplier.id),
          },
        });

        const response = await request(app.getHttpServer())
          .get('/contracts')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('should filter by status', async () => {
        await TestHelper.getPrisma().contract.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.contract(contractor.id, supplier.id, { status: 'ACTIVE' }),
          },
        });

        const response = await request(app.getHttpServer())
          .get('/contracts?status=ACTIVE')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.data.every((c: any) => c.status === 'ACTIVE')).toBe(true);
      });
    });

    describe('PATCH /contracts/:id', () => {
      it('should update contract', async () => {
        const contract = await TestHelper.getPrisma().contract.create({
          data: {
            organizationId: organization.id,
            ...DataFactory.contract(contractor.id, supplier.id),
          },
        });

        const updateDto = {
          status: 'COMPLETED',
        };

        const response = await request(app.getHttpServer())
          .patch(`/contracts/${contract.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.status).toBe('COMPLETED');
      });
    });
  });
});
