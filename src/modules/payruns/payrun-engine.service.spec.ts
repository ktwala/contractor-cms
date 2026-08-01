import { Test, TestingModule } from '@nestjs/testing';
import { PayrunEngineService } from './payrun-engine.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { FormulaEvaluationService } from './formula-evaluation.service';
import { SouthAfricaComputePack } from '../../country-packs/south-africa/south-africa-compute.pack';
import { LesothoComputePack } from '../../country-packs/lesotho/lesotho-compute.pack';
import { PayRunStatus, Country } from '../../common/dto/enums.dto';
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';

describe('PayrunEngineService', () => {
  let service: PayrunEngineService;
  let prisma: PrismaService;
  let auditService: AuditService;
  let formulaService: FormulaEvaluationService;
  let zaPack: SouthAfricaComputePack;
  let lsPack: LesothoComputePack;

  const mockPrisma: any = {
    payRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lineItemInput: {
      findMany: jest.fn(),
    },
    payItem: {
      findMany: jest.fn(),
    },
    payLine: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    employeeResult: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    payRunResult: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    payRunResultLine: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn((callback: any): any => callback(mockPrisma)),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockFormulaService = {
    loadFormulaPayItems: jest.fn(),
    evaluateFormulas: jest.fn(),
  };

  const mockZaPack = {
    pack_version: '1.0.0',
    validate: jest.fn(),
    compute: jest.fn(),
    post_process: jest.fn(),
  };

  const mockLsPack = {
    pack_version: '1.0.0',
    validate: jest.fn(),
    compute: jest.fn(),
    post_process: jest.fn(),
  };

  beforeEach(async () => {
    // Mock Logger
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrunEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: FormulaEvaluationService, useValue: mockFormulaService },
        { provide: SouthAfricaComputePack, useValue: mockZaPack },
        { provide: LesothoComputePack, useValue: mockLsPack },
      ],
    }).compile();

    service = module.get<PayrunEngineService>(PayrunEngineService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
    formulaService = module.get<FormulaEvaluationService>(FormulaEvaluationService);
    zaPack = module.get<SouthAfricaComputePack>(SouthAfricaComputePack);
    lsPack = module.get<LesothoComputePack>(LesothoComputePack);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- calculate tests ---
  describe('calculate', () => {
    const mockPayrun = {
      id: 'payrun-123',
      status: PayRunStatus.SNAPSHOT,
      payGroupId: 'paygroup-123',
      payGroup: {
        id: 'paygroup-123',
        frequency: 'MONTHLY',
        legalEntity: {
          id: 'entity-123',
          country: Country.ZA,
        },
      },
      context: {
        id: 'context-123',
        country: Country.ZA,
        currency: 'ZAR',
        legalEntityId: 'entity-123',
        taxTable: {
          effective_from: '2025-03-01',
          brackets: [
            { from_amount: 0, to_amount: 237100, rate: 0.18, base_tax: 0 },
          ],
        },
      },
      periodStart: new Date('2025-03-01'),
      periodEnd: new Date('2025-03-31'),
      payDate: new Date('2025-04-05'),
      payRunEmployees: [
        {
          id: 'pre-1',
          employeeId: 'emp-1',
          included: true,
          employee: { id: 'emp-1' },
          snapshotData: {
            compensation: { base_salary: 10000 },
            employee: { id: 'emp-1', national_id: '9001015800085' },
            employment: { employment_type: 'PERMANENT' },
            tax_profile: { residency_status: 'RESIDENT', tin: '1234567890' },
          },
        },
      ],
    };

    const mockComputeResult = {
      employee_results: [
        {
          employee_id: 'emp-1',
          totals: {
            gross: 10000,
            taxable_income: 9000,
            paye: 0,
            statutory_deductions: 500,
            other_deductions: 500,
            net: 9000,
          },
          lines: [],
          trace: [],
        },
      ],
    };

    const mockPostProcessResult = {
      summary: {
        total_gross: 10000,
        total_net: 9000,
        total_paye: 0,
      },
    };

    it('should successfully calculate payrun for South Africa', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockZaPack.validate.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      mockZaPack.compute.mockResolvedValue(mockComputeResult);
      mockZaPack.post_process.mockResolvedValue(mockPostProcessResult);
      mockPrisma.payItem.findMany.mockResolvedValue([]);
      mockPrisma.payLine.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.employeeResult.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.employeeResult.create.mockResolvedValue({ id: 'result-1' });
      mockPrisma.payLine.create.mockResolvedValue({ id: 'line-1' });

      const result = await service.calculate('payrun-123');

      expect(result).toBeDefined();
      expect(result.payrun_id).toBe('payrun-123');
      expect(result.status).toBe(PayRunStatus.CALCULATED);
      expect(result.results_count).toBe(1);
      expect(mockZaPack.validate).toHaveBeenCalled();
      expect(mockZaPack.compute).toHaveBeenCalled();
      expect(mockZaPack.post_process).toHaveBeenCalled();
    });

    it('should successfully calculate payrun for Lesotho', async () => {
      const lsPayrun = {
        ...mockPayrun,
        context: {
          ...mockPayrun.context,
          country: Country.LS,
          currency: 'LSL',
        },
        payGroup: {
          ...mockPayrun.payGroup,
          legalEntity: {
            ...mockPayrun.payGroup.legalEntity,
            country: Country.LS,
          },
        },
      };

      mockPrisma.payRun.findUnique.mockResolvedValue(lsPayrun);
      mockPrisma.payRun.update.mockResolvedValue(lsPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockLsPack.validate.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      mockLsPack.compute.mockResolvedValue(mockComputeResult);
      mockLsPack.post_process.mockResolvedValue(mockPostProcessResult);
      mockPrisma.payRunResult.create.mockResolvedValue({ id: 'result-1' });
      mockPrisma.payRunResultLine.createMany.mockResolvedValue({ count: 0 });

      const result = await service.calculate('payrun-123');

      expect(result).toBeDefined();
      expect(mockLsPack.validate).toHaveBeenCalled();
      expect(mockLsPack.compute).toHaveBeenCalled();
    });

    it('should throw BadRequestException if payrun not found', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(null);

      await expect(service.calculate('invalid-payrun')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if payrun has no context', async () => {
      const payrunNoContext = { ...mockPayrun, context: null };
      mockPrisma.payRun.findUnique.mockResolvedValue(payrunNoContext);

      await expect(service.calculate('payrun-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if payrun is not in SNAPSHOT or CALCULATED status', async () => {
      const invalidPayrun = { ...mockPayrun, status: PayRunStatus.DRAFT };
      mockPrisma.payRun.findUnique.mockResolvedValue(invalidPayrun);

      await expect(service.calculate('payrun-123')).rejects.toThrow(ConflictException);
    });

    it('should revert status to SNAPSHOT on calculation failure', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockZaPack.validate.mockRejectedValue(new Error('Validation failed'));

      await expect(service.calculate('payrun-123')).rejects.toThrow();

      // Should revert status
      expect(mockPrisma.payRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payrun-123' },
          data: { status: PayRunStatus.SNAPSHOT },
        }),
      );
    });

    it('should throw BadRequestException if validation fails', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockZaPack.validate.mockResolvedValue({
        valid: false,
        errors: ['Invalid employee data'],
        warnings: [],
      });

      await expect(service.calculate('payrun-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle validation warnings', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockZaPack.validate.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ['Minor data inconsistency'],
      });
      mockZaPack.compute.mockResolvedValue(mockComputeResult);
      mockZaPack.post_process.mockResolvedValue(mockPostProcessResult);
      mockPrisma.payItem.findMany.mockResolvedValue([]);
      mockPrisma.payLine.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.employeeResult.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.employeeResult.create.mockResolvedValue({ id: 'result-1' });
      mockPrisma.payLine.create.mockResolvedValue({ id: 'line-1' });

      const result = await service.calculate('payrun-123');

      // Should still succeed with warnings
      expect(result).toBeDefined();
      expect(result.status).toBe(PayRunStatus.CALCULATED);
    });

    it('should throw BadRequestException if compute fails', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockZaPack.validate.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      mockZaPack.compute.mockRejectedValue(new Error('Compute failed'));

      await expect(service.calculate('payrun-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if compute returns invalid result', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockZaPack.validate.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      mockZaPack.compute.mockResolvedValue(null);

      await expect(service.calculate('payrun-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if post_process fails', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockZaPack.validate.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      mockZaPack.compute.mockResolvedValue(mockComputeResult);
      mockZaPack.post_process.mockRejectedValue(new Error('Post-process failed'));

      await expect(service.calculate('payrun-123')).rejects.toThrow(BadRequestException);
    });

    it('should handle PARTIAL calculation mode', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockZaPack.validate.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      mockZaPack.compute.mockResolvedValue(mockComputeResult);
      mockZaPack.post_process.mockResolvedValue(mockPostProcessResult);
      mockPrisma.payItem.findMany.mockResolvedValue([]);
      mockPrisma.payLine.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.employeeResult.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.employeeResult.create.mockResolvedValue({ id: 'result-1' });
      mockPrisma.payLine.create.mockResolvedValue({ id: 'line-1' });

      const result = await service.calculate('payrun-123', 'PARTIAL', ['emp-1']);

      expect(result).toBeDefined();
      expect(result.status).toBe(PayRunStatus.CALCULATED);
    });

    it('should log audit entry after successful calculation', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockFormulaService.loadFormulaPayItems.mockResolvedValue([]);
      mockFormulaService.evaluateFormulas.mockReturnValue([]);
      mockZaPack.validate.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      mockZaPack.compute.mockResolvedValue(mockComputeResult);
      mockZaPack.post_process.mockResolvedValue(mockPostProcessResult);
      mockPrisma.payItem.findMany.mockResolvedValue([]);
      mockPrisma.payLine.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.employeeResult.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.employeeResult.create.mockResolvedValue({ id: 'result-1' });
      mockPrisma.payLine.create.mockResolvedValue({ id: 'line-1' });

      await service.calculate('payrun-123', 'FULL', undefined, 'user-123');

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'CALCULATE',
          entityType: 'PayRun',
          entityId: 'payrun-123',
        }),
      );
    });

    it('should throw BadRequestException if context build fails', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockPrisma.lineItemInput.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.calculate('payrun-123')).rejects.toThrow(BadRequestException);
    });
  });
});
