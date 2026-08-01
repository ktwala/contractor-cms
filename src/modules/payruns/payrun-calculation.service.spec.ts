import { Test, TestingModule } from '@nestjs/testing';
import { PayrunCalculationService } from './payrun-calculation.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PayrunsService } from './payruns.service';
import { TaxService } from '../tax/tax.service';
import { PayItemsService } from '../pay-items/pay-items.service';
import { PayRunStatus, PayItemType, Country } from '../../common/dto/enums.dto';
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';

describe('PayrunCalculationService', () => {
  let service: PayrunCalculationService;
  let prisma: PrismaService;
  let auditService: AuditService;
  let taxService: TaxService;
  let payrunsService: PayrunsService;
  let payItemsService: PayItemsService;

  const mockPrisma: any = {
    payRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lineItemInput: {
      findMany: jest.fn(),
    },
    payItem: {
      findFirst: jest.fn(),
    },
    employeeResult: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    payRunResult: {
      create: jest.fn(),
    },
    payRunResultLine: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) => {
      const tx: any = {
        ...mockPrisma,
        employeeResult: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({ id: 'result-1' }),
        },
        payLine: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return await callback(tx);
    }),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockTaxService = {
    getTaxTable: jest.fn(),
    calculatePAYE: jest.fn(),
  };

  const mockPayrunsService = {
    getPayrun: jest.fn(),
  };

  const mockPayItemsService = {
    getPayItem: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrunCalculationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: PayrunsService, useValue: mockPayrunsService },
        { provide: TaxService, useValue: mockTaxService },
        { provide: PayItemsService, useValue: mockPayItemsService },
      ],
    }).compile();

    service = module.get<PayrunCalculationService>(PayrunCalculationService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
    taxService = module.get<TaxService>(TaxService);
    payrunsService = module.get<PayrunsService>(PayrunsService);
    payItemsService = module.get<PayItemsService>(PayItemsService);

    jest.clearAllMocks();
    
    // Setup default transaction mock
    const mockTx = {
      employeeResult: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ 
          id: 'result-1',
          payrunId: 'payrun-123',
          employeeId: 'emp-1',
          gross: 10000,
          net: 9000,
        }),
      },
      payLine: {
        create: jest.fn().mockResolvedValue({ id: 'line-1' }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return await callback(mockTx);
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- startCalculation tests ---
  describe('startCalculation', () => {
    const mockPayrun = {
      id: 'payrun-123',
      status: PayRunStatus.SNAPSHOT,
      payGroupId: 'paygroup-123',
      payGroup: {
        id: 'paygroup-123',
        country: Country.ZA,
      },
      context: {
        id: 'context-123',
        country: Country.ZA,
        taxTable: {
          effective_from: '2025-03-01',
        },
      },
      payRunEmployees: [
        {
          id: 'pre-1',
          employeeId: 'emp-1',
          included: true,
          employee: {
            id: 'emp-1',
          },
          snapshotData: {
            compensation: { base_salary: 10000 },
            employee: { id: 'emp-1' },
          },
        },
      ],
    };

    const mockTaxTable = {
      id: 'tax-table-za',
      country: Country.ZA,
      effective_from: '2025-03-01',
      brackets: [
        { from_amount: 0, to_amount: 237100, rate: 0.18, base_tax: 0 },
      ],
      meta: {
        primary_rebate: 17235,
      },
    };

    it('should successfully start calculation for valid payrun', async () => {
      // Setup all mocks
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockTaxService.getTaxTable.mockResolvedValue(mockTaxTable);
      mockTaxService.calculatePAYE.mockReturnValue({
        paye: new Decimal(0),
        trace: [],
      });
      // Mock findFirst calls - first for BASIC, second for PAYE
      mockPrisma.payItem.findFirst
        .mockResolvedValueOnce({ id: 'basic-item', code: 'BASIC', type: PayItemType.EARNING })
        .mockResolvedValueOnce({ id: 'paye-item', code: 'PAYE', type: PayItemType.TAX });
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      
      // Transaction mock is set up in beforeEach

      const result = await service.startCalculation('payrun-123', 'FULL');

      expect(result).toBeDefined();
      expect(result.payrun_id).toBe('payrun-123');
      expect(result.status).toBe(PayRunStatus.CALCULATED);
      // Service calls update twice: first to CALCULATING, then to CALCULATED
      expect(mockPrisma.payRun.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.payRun.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: 'payrun-123' },
          data: expect.objectContaining({
            status: PayRunStatus.CALCULATED,
          }),
        }),
      );
    });

    it('should throw BadRequestException if payrun not found', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(null);

      await expect(
        service.startCalculation('invalid-payrun', 'FULL'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if payrun is not in SNAPSHOT or CALCULATED status', async () => {
      const invalidPayrun = { ...mockPayrun, status: PayRunStatus.DRAFT };
      mockPrisma.payRun.findUnique.mockResolvedValue(invalidPayrun);

      await expect(
        service.startCalculation('payrun-123', 'FULL'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if payrun has no context', async () => {
      const payrunNoContext = { ...mockPayrun, context: null };
      mockPrisma.payRun.findUnique.mockResolvedValue(payrunNoContext);

      await expect(
        service.startCalculation('payrun-123', 'FULL'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should revert status to SNAPSHOT on calculation failure', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockTaxService.getTaxTable.mockRejectedValue(new Error('Tax table error'));

      await expect(
        service.startCalculation('payrun-123', 'FULL'),
      ).rejects.toThrow();

      // Should revert status
      expect(mockPrisma.payRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payrun-123' },
          data: { status: PayRunStatus.SNAPSHOT },
        }),
      );
    });

    it('should handle PARTIAL calculation mode', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockTaxService.getTaxTable.mockResolvedValue(mockTaxTable);
      mockTaxService.calculatePAYE.mockReturnValue({
        paye: new Decimal(0),
        trace: [],
      });
      mockPrisma.payItem.findFirst
        .mockResolvedValueOnce({ id: 'basic-item', code: 'BASIC', type: PayItemType.EARNING })
        .mockResolvedValueOnce({ id: 'paye-item', code: 'PAYE', type: PayItemType.TAX });
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      
      // Transaction mock is set up in beforeEach

      const result = await service.startCalculation(
        'payrun-123',
        'PARTIAL',
        ['emp-1'],
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(PayRunStatus.CALCULATED);
    });

    it('should log audit entry after successful calculation', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockTaxService.getTaxTable.mockResolvedValue(mockTaxTable);
      mockTaxService.calculatePAYE.mockReturnValue({
        paye: new Decimal(0),
        trace: [],
      });
      mockPrisma.payItem.findFirst
        .mockResolvedValueOnce({ id: 'basic-item', code: 'BASIC', type: PayItemType.EARNING })
        .mockResolvedValueOnce({ id: 'paye-item', code: 'PAYE', type: PayItemType.TAX });
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      
      // Transaction mock is set up in beforeEach

      await service.startCalculation('payrun-123', 'FULL', undefined, 'user-123', 'Test calculation');

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'CALCULATE',
          entityType: 'PayRun',
          entityId: 'payrun-123',
          reason: 'Test calculation',
        }),
      );
    });

    it('should throw BadRequestException if tax table not found', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockTaxService.getTaxTable.mockRejectedValue(new Error('Tax table not found'));

      await expect(
        service.startCalculation('payrun-123', 'FULL'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if tax table has no brackets', async () => {
      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      const invalidTaxTable = { ...mockTaxTable, brackets: [] };
      mockTaxService.getTaxTable.mockResolvedValue(invalidTaxTable);

      await expect(
        service.startCalculation('payrun-123', 'FULL'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no employees to calculate', async () => {
      const payrunNoEmployees = {
        ...mockPayrun,
        payRunEmployees: [],
      };
      mockPrisma.payRun.findUnique
        .mockResolvedValueOnce(payrunNoEmployees)
        .mockResolvedValueOnce(payrunNoEmployees);
      mockPrisma.payRun.update.mockResolvedValue(payrunNoEmployees);
      mockTaxService.getTaxTable.mockResolvedValue(mockTaxTable);

      await expect(
        service.startCalculation('payrun-123', 'FULL'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- Error handling tests ---
  describe('Error Handling', () => {
    it('should handle calculation errors for individual employees', async () => {
      const mockPayrun = {
        id: 'payrun-123',
        status: PayRunStatus.SNAPSHOT,
        payGroupId: 'paygroup-123',
        payGroup: { id: 'paygroup-123', country: Country.ZA },
        context: {
          id: 'context-123',
          country: Country.ZA,
          taxTable: { effective_from: '2025-03-01' },
        },
        payRunEmployees: [
          {
            id: 'pre-1',
            employeeId: 'emp-1',
            included: true,
            snapshotData: {
              compensation: { base_salary: 10000 },
              employee: { id: 'emp-1' },
            },
          },
          {
            id: 'pre-2',
            employeeId: 'emp-2',
            included: true,
            snapshotData: {
              compensation: { base_salary: 20000 },
              employee: { id: 'emp-2' },
            },
          },
        ],
      };

      const mockTaxTable = {
        id: 'tax-table-za',
        country: Country.ZA,
        effective_from: '2025-03-01',
        brackets: [{ from_amount: 0, to_amount: 237100, rate: 0.18, base_tax: 0 }],
        meta: { primary_rebate: 17235 },
      };

      mockPrisma.payRun.findUnique.mockResolvedValue(mockPayrun);
      mockPrisma.payRun.update.mockResolvedValue(mockPayrun);
      mockTaxService.getTaxTable.mockResolvedValue(mockTaxTable);
      mockPrisma.lineItemInput.findMany.mockResolvedValue([]);
      mockPrisma.payItem.findFirst
        .mockResolvedValueOnce({ id: 'basic-item', code: 'BASIC' })
        .mockResolvedValueOnce({ id: 'paye-item', code: 'PAYE' });

      // First employee succeeds, second fails
      mockTaxService.calculatePAYE
        .mockReturnValueOnce({
          paye: new Decimal(0),
          trace: [],
        })
        .mockImplementationOnce(() => {
          throw new Error('PAYE calculation failed');
        });

      mockPrisma.payRunResult.create.mockResolvedValue({ id: 'result-1' });
      mockPrisma.payRunResultLine.createMany.mockResolvedValue({ count: 0 });

      await expect(
        service.startCalculation('payrun-123', 'FULL'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
