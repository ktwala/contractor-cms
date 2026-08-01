import { SupplierStatus } from '@prisma/client';
import { SupplierOperationalTrustService } from '../supplier-operational-trust.service';

describe('SupplierOperationalTrustService', () => {
  const supplierId = 'supplier-horizon';
  const orgId = 'org-mtn';

  const prisma = {
    supplier: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
    hcmContractorStaging: {
      findMany: jest.fn(),
    },
    contractor: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    supplierSourceStaging: {
      findMany: jest.fn(),
    },
  };

  const accessContext = {
    isGlobalAccess: false,
    targetOrganizationId: orgId,
    actorUserId: 'user-1',
  } as any;

  let service: SupplierOperationalTrustService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.hcmContractorStaging.findMany.mockResolvedValue([]);
    prisma.supplierSourceStaging.findMany.mockResolvedValue([]);
    prisma.contractor.findMany.mockResolvedValue([]);
    prisma.contractor.groupBy.mockResolvedValue([]);
    prisma.supplier.findMany.mockImplementation(async (args: { where?: { status?: SupplierStatus } }) => {
      if (args?.where?.status === SupplierStatus.SUSPENDED) return [];
      if (args?.where?.status === SupplierStatus.PENDING_APPROVAL) return [];
      if (args?.where?.status === SupplierStatus.ACTIVE) return [];
      return [];
    });
    service = new SupplierOperationalTrustService(prisma as any);
  });

  it('returns Operational Trust evidence from audit log', async () => {
    prisma.supplier.findFirst.mockResolvedValue({
      id: supplierId,
      status: SupplierStatus.ACTIVE,
      externalSupplierId: 'ORCL-SUP-MTN-004',
    });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        action: 'SUPPLIER_APPROVED',
        createdAt: new Date('2026-07-06T10:00:00.000Z'),
        metadata: {
          reason: 'Supplier enabled for External Workforce participation.',
        },
        actor: { firstName: 'Operations', lastName: 'Admin', email: 'ops@demo' },
      },
    ]);

    const evidence = await service.getEvidence(accessContext, supplierId);

    expect(evidence.currentStateLabel).toBe('Operational Trust Granted');
    expect(evidence.oracleProcurementLabel).toBe('Approved');
    expect(evidence.latestGrant).toMatchObject({
      kind: 'GRANTED',
      label: 'Operational Trust Granted',
      actorDisplayName: 'Operations Admin',
      reason: 'Supplier enabled for External Workforce participation.',
    });
  });

  it('labels restore transitions as Operational Trust Restored', async () => {
    prisma.supplier.findFirst.mockResolvedValue({
      id: supplierId,
      status: SupplierStatus.ACTIVE,
      externalSupplierId: 'ORCL-SUP-MTN-003',
    });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        action: 'SUPPLIER_APPROVED',
        createdAt: new Date('2026-07-08T14:00:00.000Z'),
        metadata: {
          fromStatus: SupplierStatus.SUSPENDED,
          toStatus: SupplierStatus.ACTIVE,
          reason: 'Compliance evidence accepted.',
        },
        actor: { firstName: 'Operations', lastName: 'Manager', email: 'ops@demo' },
      },
      {
        action: 'SUPPLIER_SUSPENDED',
        createdAt: new Date('2026-07-01T09:00:00.000Z'),
        metadata: { reason: 'Supplier compliance issue.' },
        actor: { firstName: 'Operations', lastName: 'Manager', email: 'ops@demo' },
      },
    ]);

    const evidence = await service.getEvidence(accessContext, supplierId);

    expect(evidence.latestGrant).toMatchObject({
      kind: 'RESTORED',
      label: 'Operational Trust Restored',
    });
    expect(evidence.events[0].kind).toBe('RESTORED');
  });

  it('throws when supplier is not found', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null);

    await expect(service.getEvidence(accessContext, supplierId)).rejects.toThrow(
      'Supplier not found',
    );
  });

  it('lists workforce impact findings owned by Supplier Governance', async () => {
    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 'sup-horizon',
        status: SupplierStatus.PENDING_APPROVAL,
        companyName: 'Horizon Staffing Solutions (Pty) Ltd',
        tradingName: 'Horizon Staffing',
      },
    ]);
    prisma.hcmContractorStaging.findMany.mockResolvedValue([
      { normalizedPayloadJson: { supplier: 'Horizon Staffing' } },
      { normalizedPayloadJson: { supplier: 'Horizon Staffing' } },
    ]);

    const impact = await service.listWorkforceImpactFindings(accessContext);

    expect(impact.findings).toHaveLength(1);
    expect(impact.workersAssessedPopulation).toBe(2);
    expect(impact.populationScope).toContain('worker assessment findings');
    expect(impact.findings[0]).toMatchObject({
      supplierId: 'sup-horizon',
      supplierName: 'Horizon Staffing',
      operationalTrustStatus: SupplierStatus.PENDING_APPROVAL,
      affectedWorkerCount: 2,
      impactSummary: 'Workers cannot be operationalized.',
      resolutionAction: 'Grant Operational Trust',
    });
  });

  it('evaluates integrity PASS when all Supplier Governance invariants hold', async () => {
    const report = await service.evaluateIntegrity(accessContext);

    expect(report.integrity).toBe('PASS');
    expect(report.evaluatedInvariants).toBe(5);
    expect(report.violations).toBe(0);
    expect(report.invariants.every((inv) => inv.status === 'PASS')).toBe(true);
  });

  it('evaluates integrity FAIL when operational worker lacks granted supplier trust', async () => {
    prisma.contractor.findMany.mockResolvedValue([
      {
        id: 'ctr-1',
        supplier: {
          id: 'sup-atlas',
          status: SupplierStatus.SUSPENDED,
          companyName: 'Atlas Consulting',
          tradingName: 'Atlas Consulting',
        },
      },
    ]);
    prisma.supplier.findMany.mockImplementation(async (args: { where?: { status?: SupplierStatus } }) => {
      if (args?.where?.status === SupplierStatus.SUSPENDED) {
        return [
          {
            id: 'sup-atlas',
            companyName: 'Atlas Consulting',
            tradingName: 'Atlas Consulting',
          },
        ];
      }
      return [];
    });
    prisma.contractor.groupBy.mockResolvedValue([
      { supplierId: 'sup-atlas', _count: { id: 1 } },
    ]);

    const report = await service.evaluateIntegrity(accessContext);

    expect(report.integrity).toBe('FAIL');
    expect(report.violations).toBeGreaterThan(0);
    expect(
      report.invariants.find((inv) => inv.id === 'OPERATIONAL_WORKER_REQUIRES_GRANTED_TRUST')?.status,
    ).toBe('FAIL');
    expect(
      report.invariants.find((inv) => inv.id === 'SUSPENDED_SUPPLIER_HAS_NO_OPERATIONAL_WORKERS')?.status,
    ).toBe('FAIL');
  });
});
