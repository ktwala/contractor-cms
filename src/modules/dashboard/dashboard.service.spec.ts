import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../core/database/prisma.service';
import { SetupService } from '../setup/setup.service';
import { HierarchyIntegrityService } from '../hierarchy/hierarchy-integrity.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrisma = {} as PrismaService;
  const mockHierarchyIntegrity = {
    getReport: jest.fn().mockResolvedValue({
      employees_total: 0,
      manager_assigned: 0,
      missing_manager: 0,
      cycles_detected: 0,
      max_depth: 0,
      largest_span: 0,
      status: 'READY' as const,
    }),
  };
  const mockSetupService = {
    getStatus: jest.fn().mockResolvedValue({
      complete: false,
      items: [
        { key: 'legal_entity', label: 'Legal Entities', ready: true, count: 1, href: '/enterprise/legal-entities' },
      ],
      legal_entities: 1,
      org_units: 0,
      cost_centers: 0,
      company_groups: 0,
      positions: 0,
      employees: 0,
      employments: 0,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SetupService, useValue: mockSetupService },
        { provide: HierarchyIntegrityService, useValue: mockHierarchyIntegrity },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('empty scope regression', () => {
    /**
     * When user has widget permission but legalEntityAccess = [],
     * endpoints must return zeros/empty, NOT 403 and NOT platform-wide data.
     */
    const emptyScope = { legalEntityIds: [] };

    it('getWorkforceSummary returns zeros for empty scope', async () => {
      const result = await service.getWorkforceSummary(emptyScope);
      expect(result).toEqual({
        employees: 0,
        employments: 0,
        org_units: 0,
        cost_centers: 0,
        legal_entities: 0,
        positions: 0,
      });
    });

    it('getPayrollSnapshotSummary returns empty for empty scope', async () => {
      const result = await service.getPayrollSnapshotSummary(emptyScope);
      expect(result).toMatchObject({
        current_period: null,
        pending_approvals: 0,
        exceptions: 0,
        payment_batches: 0,
        next_pay_date: null,
        setup_required: true,
      });
    });

    it('getComplianceSummary returns NOT_CONFIGURED for empty scope', async () => {
      const result = await service.getComplianceSummary(emptyScope);
      expect(result).toEqual({
        emp201: { status: 'NOT_CONFIGURED' },
        irp5: { status: 'NOT_CONFIGURED' },
        alerts: 0,
        tax_tables_configured: false,
      });
    });

    it('getHrExportReadiness returns NOT_READY for empty scope', async () => {
      const result = await service.getHrExportReadiness(emptyScope);
      expect(result).toMatchObject({
        status: 'NOT_READY',
        exportable_employees: 0,
        warnings: 0,
        issues: [{ code: 'NO_LEGAL_ENTITY_ACCESS', count: 0 }],
      });
    });

    it('getPendingApprovals returns empty for empty scope', async () => {
      const result = await service.getPendingApprovals('user-123', emptyScope);
      expect(result).toEqual({
        total_pending: 0,
        my_pending: 0,
        items: [],
      });
    });

    it('getPendingApprovals returns empty when scope is undefined', async () => {
      const result = await service.getPendingApprovals('user-123', undefined);
      expect(result).toEqual({
        total_pending: 0,
        my_pending: 0,
        items: [],
      });
    });
  });

  describe('GLOBAL scope regression', () => {
    /**
     * When user has GLOBAL scope (legalEntityAccess = all entities),
     * endpoints must return platform-wide data, not zeros.
     * Protects the superadmin/tenant-admin path.
     */
    const globalScope = { legalEntityIds: ['le-1', 'le-2'] };

    beforeEach(() => {
      (mockPrisma as any).employee = { count: jest.fn().mockResolvedValue(100) };
      (mockPrisma as any).employment = { count: jest.fn().mockResolvedValue(100) };
      (mockPrisma as any).orgUnit = { count: jest.fn().mockResolvedValue(5) };
      (mockPrisma as any).costCenter = { count: jest.fn().mockResolvedValue(8) };
      (mockPrisma as any).legalEntity = { count: jest.fn().mockResolvedValue(2) };
      (mockPrisma as any).position = { count: jest.fn().mockResolvedValue(12) };
    });

    it('getWorkforceSummary returns platform-wide counts for GLOBAL scope', async () => {
      const result = await service.getWorkforceSummary(globalScope);
      expect(result.employees).toBe(100);
      expect(result.employments).toBe(100);
      expect(result.org_units).toBe(5);
      expect(result.cost_centers).toBe(8);
      expect(result.legal_entities).toBe(2);
      expect(result.positions).toBe(12);
    });
  });

  describe('getDashboardSummary', () => {
    const baseUser = {
      sub: 'user-123',
      email: 'test@example.com',
      roles: [] as string[],
      permissions: [] as string[],
      legalEntityAccess: [] as string[],
      hasGlobalScope: false,
    };

    it('returns all widgets with visible: false when user has no dashboard permissions', async () => {
      const user = { ...baseUser, permissions: ['audit:events:read'] };
      (mockPrisma as any).dataImportJob = {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      };
      (mockPrisma as any).dataImportRow = { count: jest.fn().mockResolvedValue(0) };

      const result = await service.getDashboardSummary(user);

      expect(result.meta.scope_mode).toBe('EMPTY');
      expect(result.meta.legal_entity_count).toBe(0);
      expect(result.widgets.setup_progress).toEqual({ visible: false });
      expect(result.widgets.workforce_snapshot).toEqual({ visible: false });
      expect(result.widgets.payroll_snapshot).toEqual({ visible: false });
      expect(result.widgets.compliance_snapshot).toEqual({ visible: false });
      expect(result.widgets.pending_approvals).toEqual({ visible: false });
      expect(result.widgets.data_imports).toEqual({ visible: false });
      expect(result.widgets.hr_export_readiness).toEqual({ visible: false });
      expect(mockSetupService.getStatus).not.toHaveBeenCalled();
    });

    it('returns visible: true for setup_progress when user has iam:legal_entities:manage', async () => {
      const user = { ...baseUser, permissions: ['iam:legal_entities:manage'] };
      (mockPrisma as any).dataImportJob = {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      };
      (mockPrisma as any).dataImportRow = { count: jest.fn().mockResolvedValue(0) };

      const result = await service.getDashboardSummary(user);

      expect(result.widgets.setup_progress).toMatchObject({ visible: true });
      expect(result.widgets.setup_progress).toHaveProperty('data');
      expect((result.widgets.setup_progress as any).data).toHaveProperty('summary');
      expect((result.widgets.setup_progress as any).data).toHaveProperty('items');
      expect(mockSetupService.getStatus).toHaveBeenCalled();
    });

    it('returns scope_mode EMPTY and zeroed/empty scoped data when legalEntityAccess is empty', async () => {
      const user = {
        ...baseUser,
        permissions: ['employee:read', 'payrun:read', 'hr:read'],
        legalEntityAccess: [],
      };
      (mockPrisma as any).dataImportJob = {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      };
      (mockPrisma as any).dataImportRow = { count: jest.fn().mockResolvedValue(0) };

      const result = await service.getDashboardSummary(user);

      expect(result.meta.scope_mode).toBe('EMPTY');
      expect(result.widgets.workforce_snapshot).toMatchObject({
        visible: true,
        data: {
          employees: 0,
          employments: 0,
          org_units: 0,
          cost_centers: 0,
          legal_entities: 0,
          positions: 0,
        },
      });
      expect(result.widgets.payroll_snapshot).toMatchObject({
        visible: true,
        data: expect.objectContaining({
          current_period: null,
          pending_approvals: 0,
          next_pay_date: null,
          setup_required: true,
        }),
      });
      expect(result.widgets.hr_export_readiness).toMatchObject({
        visible: true,
        data: expect.objectContaining({
          status: 'NOT_READY',
          exportable_employees: 0,
          issues: expect.arrayContaining([expect.objectContaining({ code: 'NO_LEGAL_ENTITY_ACCESS' })]),
        }),
      });
    });

    it('returns scope_mode GLOBAL when hasGlobalScope and legalEntityAccess is non-empty', async () => {
      (mockPrisma as any).employee = { count: jest.fn().mockResolvedValue(50) };
      (mockPrisma as any).employment = {
        count: jest.fn().mockResolvedValue(50),
        findMany: jest.fn().mockResolvedValue([{ employeeId: 'e1' }]),
      };
      (mockPrisma as any).orgUnit = { count: jest.fn().mockResolvedValue(3) };
      (mockPrisma as any).costCenter = { count: jest.fn().mockResolvedValue(4) };
      (mockPrisma as any).legalEntity = { count: jest.fn().mockResolvedValue(2) };
      (mockPrisma as any).position = { count: jest.fn().mockResolvedValue(6) };
      (mockPrisma as any).payRun = { findMany: jest.fn().mockResolvedValue([]) };
      (mockPrisma as any).payrollException = { count: jest.fn().mockResolvedValue(0) };
      (mockPrisma as any).approvalStep = { count: jest.fn().mockResolvedValue(0) };
      (mockPrisma as any).payGroup = { count: jest.fn().mockResolvedValue(1) };
      (mockPrisma as any).taxTableSet = { count: jest.fn().mockResolvedValue(1) };
      (mockPrisma as any).eMP201Return = { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) };
      (mockPrisma as any).iRP5Certificate = { count: jest.fn().mockResolvedValue(0) };
      (mockPrisma as any).dataImportJob = {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      };
      (mockPrisma as any).dataImportRow = { count: jest.fn().mockResolvedValue(0) };

      const user = {
        ...baseUser,
        permissions: ['employee:read', 'employment:read', 'payrun:read', 'hr:read'],
        legalEntityAccess: ['le-1', 'le-2'],
        hasGlobalScope: true,
      };

      const result = await service.getDashboardSummary(user);

      expect(result.meta.scope_mode).toBe('GLOBAL');
      expect(result.meta.legal_entity_count).toBe(2);
      expect(result.widgets.workforce_snapshot).toMatchObject({
        visible: true,
        data: { employees: 50, employments: 50, org_units: 3, cost_centers: 4, legal_entities: 2, positions: 6 },
      });
    });

    it('returns scope_mode LEGAL_ENTITY when not hasGlobalScope', async () => {
      (mockPrisma as any).employee = { count: jest.fn().mockResolvedValue(10) };
      (mockPrisma as any).employment = {
        count: jest.fn().mockResolvedValue(10),
        findMany: jest.fn().mockResolvedValue([{ employeeId: 'e1' }]),
      };
      (mockPrisma as any).orgUnit = { count: jest.fn().mockResolvedValue(1) };
      (mockPrisma as any).costCenter = { count: jest.fn().mockResolvedValue(2) };
      (mockPrisma as any).legalEntity = { count: jest.fn().mockResolvedValue(1) };
      (mockPrisma as any).position = { count: jest.fn().mockResolvedValue(2) };
      (mockPrisma as any).payRun = { findMany: jest.fn().mockResolvedValue([]) };
      (mockPrisma as any).payrollException = { count: jest.fn().mockResolvedValue(0) };
      (mockPrisma as any).approvalStep = { count: jest.fn().mockResolvedValue(0) };
      (mockPrisma as any).payGroup = { count: jest.fn().mockResolvedValue(1) };
      (mockPrisma as any).taxTableSet = { count: jest.fn().mockResolvedValue(1) };
      (mockPrisma as any).eMP201Return = { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) };
      (mockPrisma as any).iRP5Certificate = { count: jest.fn().mockResolvedValue(0) };
      (mockPrisma as any).dataImportJob = {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      };
      (mockPrisma as any).dataImportRow = { count: jest.fn().mockResolvedValue(0) };

      const user = {
        ...baseUser,
        permissions: ['employee:read', 'hr:read'],
        legalEntityAccess: ['le-1'],
        hasGlobalScope: false,
      };

      const result = await service.getDashboardSummary(user);

      expect(result.meta.scope_mode).toBe('LEGAL_ENTITY');
      expect(result.meta.legal_entity_count).toBe(1);
    });
  });
});
