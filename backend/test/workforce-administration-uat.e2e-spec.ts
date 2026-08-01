import { INestApplication } from '@nestjs/common';
import {
  ContractType,
  ContractorWorkforceHistorySource,
  ContractorWorkforceState,
  SupplierType,
} from '@prisma/client';
import request from 'supertest';
import {
  CONTRACTOR_MANAGER_PERMISSIONS,
  SEED_TARGET_ROLE_PERMISSIONS,
} from '../src/core/auth/seed-system-role-bundles';
import { SUPPLIER_EVIDENCE_DOC_TYPES } from '../src/domain/suppliers/supplier-evidence-catalog';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from '../src/domain/contractors/contractor-workforce-domain-events.constants';
import { TestHelper } from './utils/test-helper';

async function seedCompanyEvidence(
  prisma: ReturnType<typeof TestHelper.getPrisma>,
  supplierId: string,
  uploadedBy: string,
) {
  const future = new Date('2030-12-31');
  const types = [
    SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION,
    SUPPLIER_EVIDENCE_DOC_TYPES.TAX_CLEARANCE,
    SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION,
    SUPPLIER_EVIDENCE_DOC_TYPES.BBBEE_CERTIFICATE,
    SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID,
    SUPPLIER_EVIDENCE_DOC_TYPES.MASTER_SUPPLIER_AGREEMENT,
  ];

  for (const type of types) {
    const needsExpiry =
      type !== SUPPLIER_EVIDENCE_DOC_TYPES.COMPANY_REGISTRATION &&
      type !== SUPPLIER_EVIDENCE_DOC_TYPES.BANK_CONFIRMATION &&
      type !== SUPPLIER_EVIDENCE_DOC_TYPES.REPRESENTATIVE_ID;

    await prisma.supplierDocument.create({
      data: {
        supplierId,
        type,
        fileName: `${type}.pdf`,
        filePath: `uploads/test/${type}.pdf`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        expiryDate: needsExpiry ? future : null,
        uploadedBy,
      },
    });
  }
}

type TimelineEntry = {
  fromState: ContractorWorkforceState | null;
  toState: ContractorWorkforceState;
  source: ContractorWorkforceHistorySource;
};

function expectTimeline(entries: TimelineEntry[], expected: TimelineEntry[]) {
  expect(entries).toHaveLength(expected.length);
  expected.forEach((step, index) => {
    expect(entries[index].fromState).toBe(step.fromState);
    expect(entries[index].toState).toBe(step.toState);
    expect(entries[index].source).toBe(step.source);
  });
}

describe('Workforce Administration UAT (PR-WORKFORCE-E2E-UAT-1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestHelper.setupTestApp();
  });

  beforeEach(async () => {
    await TestHelper.cleanupDatabase();
  });

  afterAll(async () => {
    await TestHelper.cleanupDatabase();
    await TestHelper.closeApp();
  });

  it('proves supplier-backed nomination → ops review → activation with shared timeline, registry, audit, and domain stubs', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Demo Supplier Ltd',
        email: 'demo-supplier@test.com',
        country: 'ZA',
      },
    });

    const supplierAdmin = await TestHelper.createUserWithRoles(org.id, {
      email: 'supplier.admin.uat@test.com',
      password: 'SupplierAdmin123!',
      roles: [
        {
          role: 'SUPPLIER_ADMIN',
          orgId: org.id,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN],
          isSystemRole: true,
        },
      ],
    });

    await prisma.supplierMembership.create({
      data: {
        userId: supplierAdmin.id,
        supplierId: supplier.id,
        role: 'ADMIN',
        assignedBy: supplierAdmin.id,
      },
    });

    await seedCompanyEvidence(prisma, supplier.id, supplierAdmin.id);

    const contract = await prisma.supplierContract.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        contractNumber: 'UAT-MSA-001',
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'UAT Supplier Master Agreement',
        startDate: new Date('2026-01-01'),
        status: 'ACTIVE',
      },
    });

    const opsUser = await TestHelper.createUserWithRoles(org.id, {
      email: 'ops.manager.uat@test.com',
      password: 'OpsManager123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: [...CONTRACTOR_MANAGER_PERMISSIONS],
          isSystemRole: true,
        },
      ],
    });

    const { token: supplierToken } = await TestHelper.login(
      'supplier.admin.uat@test.com',
      'SupplierAdmin123!',
    );
    const { token: opsToken } = await TestHelper.login(
      'ops.manager.uat@test.com',
      'OpsManager123!',
    );

    const nominateEmail = `uat.workforce.${Date.now()}@portal.test`;
    const nominated = await request(app.getHttpServer())
      .post('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        firstName: 'UAT',
        lastName: 'Nominee',
        email: nominateEmail,
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        nominationReason: 'Supplier portal nomination for workforce UAT',
        engagement: {
          contractId: contract.id,
          role: 'Workforce UAT Developer',
          startDate: '2026-06-01',
          rateType: 'HOURLY',
          rateAmount: 750,
        },
      })
      .expect(201);

    const contractorId = nominated.body.id as string;
    expect(nominated.body.workforceState).toBe(ContractorWorkforceState.NOMINATED);
    expect(nominated.body.isActive).toBe(false);

    const supplierTimelineAfterNominate = await request(app.getHttpServer())
      .get(`/supplier-portal/contractors/${contractorId}/workforce-history`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(200);

    expectTimeline(supplierTimelineAfterNominate.body.data, [
      {
        fromState: null,
        toState: ContractorWorkforceState.NOMINATED,
        source: ContractorWorkforceHistorySource.SUPPLIER_PORTAL,
      },
    ]);

    const reviewQueue = await request(app.getHttpServer())
      .get('/contractors/workforce-review')
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(200);

    expect(
      reviewQueue.body.data.some(
        (row: { id: string; workforceState: string }) =>
          row.id === contractorId &&
          row.workforceState === ContractorWorkforceState.NOMINATED,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        targetState: ContractorWorkforceState.PENDING_APPROVAL,
        reason: 'Ops review — submit for internal workforce review (not MTN approval workflow)',
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        targetState: ContractorWorkforceState.ACTIVE,
        reason: 'Ops activation — workforce plane only',
      })
      .expect(200);

    const registry = await request(app.getHttpServer())
      .get(`/contractors/${contractorId}`)
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(200);

    expect(registry.body.workforceState).toBe(ContractorWorkforceState.ACTIVE);
    expect(registry.body.isActive).toBe(true);

    const supplierTimelineFinal = await request(app.getHttpServer())
      .get(`/supplier-portal/contractors/${contractorId}/workforce-history`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(200);

    expectTimeline(supplierTimelineFinal.body.data, [
      {
        fromState: null,
        toState: ContractorWorkforceState.NOMINATED,
        source: ContractorWorkforceHistorySource.SUPPLIER_PORTAL,
      },
      {
        fromState: ContractorWorkforceState.NOMINATED,
        toState: ContractorWorkforceState.PENDING_APPROVAL,
        source: ContractorWorkforceHistorySource.OPS,
      },
      {
        fromState: ContractorWorkforceState.PENDING_APPROVAL,
        toState: ContractorWorkforceState.ACTIVE,
        source: ContractorWorkforceHistorySource.OPS,
      },
    ]);

    const opsTimeline = await request(app.getHttpServer())
      .get(`/contractors/${contractorId}/workforce-history`)
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(200);

    expect(opsTimeline.body.data).toHaveLength(3);

    const auditLogs = await prisma.auditLog.findMany({
      where: { targetType: 'Contractor', targetId: contractorId },
      orderBy: { createdAt: 'asc' },
    });

    const stateChanges = auditLogs.filter(
      (row) => row.action === 'CONTRACTOR_WORKFORCE_STATE_CHANGED',
    );
    expect(stateChanges.length).toBeGreaterThanOrEqual(2);

    const domainStubs = auditLogs.filter(
      (row) => row.action === 'CONTRACTOR_WORKFORCE_DOMAIN_EVENT',
    );
    expect(domainStubs.length).toBeGreaterThanOrEqual(3);

    const domainEvents = domainStubs.map(
      (row) => (row.metadata as { domainEvent?: string } | null)?.domainEvent,
    );
    expect(domainEvents).toContain(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATED);
    expect(domainEvents).toContain(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.ACTIVATED);
    expect(
      domainStubs.every(
        (row) => (row.metadata as { stub?: boolean } | null)?.stub === true,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({ targetState: ContractorWorkforceState.ACTIVE })
      .expect(403);

    const clearedQueue = await request(app.getHttpServer())
      .get('/contractors/workforce-review')
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(200);

    expect(
      clearedQueue.body.data.some((row: { id: string }) => row.id === contractorId),
    ).toBe(false);
  });

  it('proves reject, reopen, and send-back review outcomes with supplier-visible timeline', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Demo Supplier Ltd',
        email: 'demo-supplier-unhappy@test.com',
        country: 'ZA',
      },
    });

    const supplierAdmin = await TestHelper.createUserWithRoles(org.id, {
      email: 'supplier.unhappy.uat@test.com',
      password: 'SupplierAdmin123!',
      roles: [
        {
          role: 'SUPPLIER_ADMIN',
          orgId: org.id,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN],
          isSystemRole: true,
        },
      ],
    });

    await prisma.supplierMembership.create({
      data: {
        userId: supplierAdmin.id,
        supplierId: supplier.id,
        role: 'ADMIN',
        assignedBy: supplierAdmin.id,
      },
    });

    await seedCompanyEvidence(prisma, supplier.id, supplierAdmin.id);

    const contract = await prisma.supplierContract.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        contractNumber: 'UAT-UNHAPPY-001',
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'UAT Unhappy Path MSA',
        startDate: new Date('2026-01-01'),
        status: 'ACTIVE',
      },
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'ops.unhappy.uat@test.com',
      password: 'OpsManager123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: [...CONTRACTOR_MANAGER_PERMISSIONS],
          isSystemRole: true,
        },
      ],
    });

    const { token: supplierToken } = await TestHelper.login(
      'supplier.unhappy.uat@test.com',
      'SupplierAdmin123!',
    );
    const { token: opsToken } = await TestHelper.login(
      'ops.unhappy.uat@test.com',
      'OpsManager123!',
    );

    const nominateEmail = `uat.unhappy.${Date.now()}@portal.test`;
    const nominated = await request(app.getHttpServer())
      .post('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        firstName: 'Unhappy',
        lastName: 'Path',
        email: nominateEmail,
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        engagement: {
          contractId: contract.id,
          role: 'Developer',
          startDate: '2026-06-01',
          rateType: 'HOURLY',
          rateAmount: 750,
        },
      })
      .expect(201);

    const contractorId = nominated.body.id as string;

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        targetState: ContractorWorkforceState.REJECTED,
        reason: 'Incomplete placement details at intake',
      })
      .expect(200);

    const rejectedDetail = await request(app.getHttpServer())
      .get(`/supplier-portal/contractors/${contractorId}`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(200);

    expect(rejectedDetail.body.data.workforceState).toBe(ContractorWorkforceState.REJECTED);

    const rejectedTimeline = await request(app.getHttpServer())
      .get(`/supplier-portal/contractors/${contractorId}/workforce-history`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(200);

    expect(rejectedTimeline.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toState: ContractorWorkforceState.REJECTED,
          transitionLabel: 'Rejected',
          reason: 'Incomplete placement details at intake',
        }),
      ]),
    );

    const rejectedList = await request(app.getHttpServer())
      .get('/contractors/workforce-rejected')
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(200);

    expect(
      rejectedList.body.data.some((row: { id: string }) => row.id === contractorId),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        targetState: ContractorWorkforceState.NOMINATED,
        reason: 'Supplier corrected placement details',
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        targetState: ContractorWorkforceState.PENDING_APPROVAL,
        reason: 'Resubmitted after correction',
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        targetState: ContractorWorkforceState.NOMINATED,
        reason: 'Rate mismatch — return to supplier',
      })
      .expect(200);

    const finalTimeline = await request(app.getHttpServer())
      .get(`/supplier-portal/contractors/${contractorId}/workforce-history`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(200);

    expect(finalTimeline.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transitionLabel: 'Returned to supplier',
          reason: 'Rate mismatch — return to supplier',
        }),
        expect.objectContaining({
          transitionLabel: 'Reopened nomination',
          reason: 'Supplier corrected placement details',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ targetState: ContractorWorkforceState.REJECTED })
      .expect(400);
  });

  it('proves ops blacklist requires reason and authority note; supplier cannot blacklist', async () => {
    const org = await TestHelper.createTestOrganization();
    const prisma = TestHelper.getPrisma();

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        type: SupplierType.COMPANY,
        status: 'ACTIVE',
        companyName: 'Blacklist Supplier',
        email: 'blacklist-supplier@test.com',
        country: 'ZA',
      },
    });

    const supplierAdmin = await TestHelper.createUserWithRoles(org.id, {
      email: 'supplier.blacklist.uat@test.com',
      password: 'SupplierAdmin123!',
      roles: [
        {
          role: 'SUPPLIER_ADMIN',
          orgId: org.id,
          permissions: [...SEED_TARGET_ROLE_PERMISSIONS.SUPPLIER_ADMIN],
          isSystemRole: true,
        },
      ],
    });

    await prisma.supplierMembership.create({
      data: {
        userId: supplierAdmin.id,
        supplierId: supplier.id,
        role: 'ADMIN',
        assignedBy: supplierAdmin.id,
      },
    });

    await seedCompanyEvidence(prisma, supplier.id, supplierAdmin.id);

    const contract = await prisma.supplierContract.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        contractNumber: 'UAT-BLACKLIST-001',
        contractType: ContractType.TIME_AND_MATERIALS,
        title: 'Blacklist UAT MSA',
        startDate: new Date('2026-01-01'),
        status: 'ACTIVE',
      },
    });

    await TestHelper.createUserWithRoles(org.id, {
      email: 'ops.blacklist.uat@test.com',
      password: 'OpsManager123!',
      roles: [
        {
          role: 'CONTRACTOR_MANAGER',
          orgId: org.id,
          permissions: [...CONTRACTOR_MANAGER_PERMISSIONS],
          isSystemRole: true,
        },
      ],
    });

    const { token: supplierToken } = await TestHelper.login(
      'supplier.blacklist.uat@test.com',
      'SupplierAdmin123!',
    );
    const { token: opsToken } = await TestHelper.login(
      'ops.blacklist.uat@test.com',
      'OpsManager123!',
    );

    const nominated = await request(app.getHttpServer())
      .post('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        firstName: 'Block',
        lastName: 'Candidate',
        email: `blacklist.${Date.now()}@portal.test`,
        workerClassification: 'INDEPENDENT_CONTRACTOR',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
        engagement: {
          contractId: contract.id,
          role: 'Developer',
          startDate: '2026-06-01',
          rateType: 'HOURLY',
          rateAmount: 750,
        },
      })
      .expect(201);

    const contractorId = nominated.body.id as string;

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        targetState: ContractorWorkforceState.BLACKLISTED,
        reason: 'Policy block — fraudulent credentials',
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        targetState: ContractorWorkforceState.BLACKLISTED,
        reason: 'Policy block — fraudulent credentials',
        authorityNote: 'Ops director approval ref UAT-BL-001',
      })
      .expect(200);

    const history = await prisma.contractorWorkforceHistory.findMany({
      where: { contractorId },
      orderBy: { occurredAt: 'asc' },
    });
    const blacklistRow = history.find(
      (row) => row.toState === ContractorWorkforceState.BLACKLISTED,
    );
    expect(blacklistRow?.reason).toBe('Policy block — fraudulent credentials');
    expect(blacklistRow?.metadata).toEqual(
      expect.objectContaining({
        authorityNote: 'Ops director approval ref UAT-BL-001',
        workforceBlock: true,
      }),
    );

    await request(app.getHttpServer())
      .get('/supplier-portal/contractors')
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(200)
      .then((res) => {
        expect(res.body.data.some((c: { id: string }) => c.id === contractorId)).toBe(false);
      });

    await request(app.getHttpServer())
      .patch(`/contractors/${contractorId}/workforce-transition`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        targetState: ContractorWorkforceState.BLACKLISTED,
        reason: 'Supplier attempt',
        authorityNote: 'N/A',
      })
      .expect(403);
  });
});
