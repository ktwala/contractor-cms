import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E Test: PayRun Calculation Flow
 *
 * Prerequisites:
 * 1. Run `npm run db:push` to sync schema
 * 2. Run `npm run db:seed` to populate test data
 *
 * Test flow:
 * 1. Create a new payrun for the seeded pay group
 * 2. Snapshot the payrun (freeze employee data)
 * 3. Calculate using the country-pack engine
 * 4. Verify results are persisted
 */
describe('PayRun Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let payGroupId: string;
  let payPeriodId: string;
  let payrunId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Get seeded pay group and pay period
    const payGroup = await prisma.payGroup.findFirst({
      where: { code: 'ZA-MONTHLY-001' },
    });
    payGroupId = payGroup!.id;

    const payPeriod = await prisma.payPeriod.findFirst({
      where: {
        payGroupId,
        status: 'OPEN',
      },
      orderBy: { periodStart: 'asc' },
    });
    payPeriodId = payPeriod!.id;

    // TODO: Get auth token from test user
    // For now, this is a placeholder - implement based on your auth strategy
    authToken = 'test-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Full Payrun Lifecycle', () => {
    it('should create a new payrun', async () => {
      const response = await request(app.getHttpServer())
        .post('/payruns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pay_group_id: payGroupId,
          pay_period_id: payPeriodId,
          type: 'REGULAR',
          name: 'E2E Test Payrun',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('DRAFT');
      payrunId = response.body.id;
    });

    it('should preview inclusions', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payruns/${payrunId}/inclusions/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('employee_count');
      expect(response.body.employee_count).toBeGreaterThan(0);
    });

    it('should snapshot the payrun', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payruns/${payrunId}/snapshot`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          snapshot_effective_at: new Date().toISOString(),
        })
        .expect(200);

      expect(response.body.status).toBe('SNAPSHOT');
    });

    it('should add a line item input', async () => {
      // Add overtime for the first employee
      const employees = await prisma.employee.findMany({
        where: { payGroupId },
        take: 1,
      });

      const response = await request(app.getHttpServer())
        .post(`/payruns/${payrunId}/inputs/line-items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: employees[0].id,
          pay_item_code: 'OVERTIME',
          amount: 2500.0,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.pay_item_code).toBe('OVERTIME');
    });

    it('should calculate using the engine', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payruns/${payrunId}/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mode: 'FULL',
          use_engine: true,
        })
        .expect(202);

      expect(response.body.status).toBe('CALCULATED');
      expect(response.body).toHaveProperty('summary');
    });

    it('should have employee results', async () => {
      const response = await request(app.getHttpServer())
        .get(`/payruns/${payrunId}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should have correct tax calculations', async () => {
      const results = await prisma.employeeResult.findMany({
        where: { payrunId },
        include: {
          payLines: {
            include: { payItem: true },
          },
        },
      });

      for (const result of results) {
        const payeLines = result.payLines.filter(
          (pl) => pl.payItem.code === 'PAYE',
        );

        // Verify PAYE was calculated for employees above threshold
        if (Number(result.grossPay) > 95750) {
          expect(payeLines.length).toBeGreaterThan(0);
        }
      }
    });

    it('should submit for approval', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payruns/${payrunId}/submit-for-approval`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ note: 'E2E test submission' })
        .expect(200);

      expect(response.body.status).toBe('IN_REVIEW');
    });

    it('should approve the payrun', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payruns/${payrunId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ approval_comment: 'E2E test approval' })
        .expect(200);

      expect(response.body.status).toBe('APPROVED');
    });
  });

  describe('Partial Recalculation', () => {
    let recalcPayrunId: string;

    beforeAll(async () => {
      // Create another payrun for partial recalc test
      const payrun = await prisma.payRun.create({
        data: {
          payGroupId,
          payPeriodId,
          type: 'REGULAR',
          status: 'SNAPSHOT',
          name: 'Partial Recalc Test',
        },
      });
      recalcPayrunId = payrun.id;
    });

    it('should recalculate specific employees only', async () => {
      const employees = await prisma.employee.findMany({
        where: { payGroupId },
        take: 2,
      });

      const response = await request(app.getHttpServer())
        .post(`/payruns/${recalcPayrunId}/calculate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mode: 'PARTIAL',
          use_engine: true,
          recalculate_employee_ids: [employees[0].id],
        })
        .expect(202);

      // Only the specified employee should have results
      const results = await prisma.employeeResult.findMany({
        where: { payrunId: recalcPayrunId },
      });

      expect(results.length).toBe(1);
      expect(results[0].employeeId).toBe(employees[0].id);
    });
  });
});

/**
 * Manual Test Script (can be run via ts-node)
 *
 * Usage: npx ts-node test/payrun-flow.e2e-spec.ts --manual
 */
async function manualTest() {
  if (!process.argv.includes('--manual')) return;

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Checking seed data...\n');

    const payGroup = await prisma.payGroup.findFirst({
      where: { code: 'ZA-MONTHLY-001' },
      include: { _count: { select: { employees: true, payItems: true } } },
    });

    if (!payGroup) {
      console.log('❌ No pay group found. Run: npm run db:seed');
      return;
    }

    console.log(`✅ Pay Group: ${payGroup.name}`);
    console.log(`   Employees: ${payGroup._count.employees}`);
    console.log(`   Pay Items: ${payGroup._count.payItems}\n`);

    const payPeriods = await prisma.payPeriod.count({
      where: { payGroupId: payGroup.id },
    });
    console.log(`✅ Pay Periods: ${payPeriods}\n`);

    const taxTables = await prisma.taxTableSet.count();
    console.log(`✅ Tax Table Sets: ${taxTables}\n`);

    // Test creating a payrun
    console.log('📝 Creating test payrun...');
    const payPeriod = await prisma.payPeriod.findFirst({
      where: { payGroupId: payGroup.id, status: 'OPEN' },
    });

    const payrun = await prisma.payRun.create({
      data: {
        payGroupId: payGroup.id,
        payPeriodId: payPeriod!.id,
        type: 'REGULAR',
        status: 'DRAFT',
        name: `Manual Test ${new Date().toISOString()}`,
      },
    });
    console.log(`✅ Created payrun: ${payrun.id}\n`);

    // Cleanup
    await prisma.payRun.delete({ where: { id: payrun.id } });
    console.log('🧹 Cleaned up test payrun\n');

    console.log('✅ All checks passed! Ready for E2E testing.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

manualTest();
