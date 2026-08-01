import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TaxService, TaxBracket } from './tax.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { Country } from '../../common/dto/enums.dto';
import Decimal from 'decimal.js';

describe('TaxService', () => {
  let service: TaxService;
  let prismaService: PrismaService;
  let auditService: AuditService;

  const mockPrismaService = {
    taxTable: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    taxBracket: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<TaxService>(TaxService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculatePAYE', () => {
    // South Africa 2025/2026 tax brackets (from seed.ts)
    const southAfricaBrackets: TaxBracket[] = [
      { from_amount: 0, to_amount: 237100, rate: 0.18, base_tax: 0 },
      { from_amount: 237101, to_amount: 370500, rate: 0.26, base_tax: 42678 },
      { from_amount: 370501, to_amount: 512800, rate: 0.31, base_tax: 77362 },
      { from_amount: 512801, to_amount: 673000, rate: 0.36, base_tax: 121475 },
      { from_amount: 673001, to_amount: 857900, rate: 0.39, base_tax: 179147 },
      { from_amount: 857901, to_amount: 1817000, rate: 0.41, base_tax: 251258 },
      { from_amount: 1817001, to_amount: null, rate: 0.45, base_tax: 644489 },
    ];

    describe('basic bracket calculations', () => {
      it('should calculate PAYE for first bracket (18%)', () => {
        const taxableIncome = new Decimal(100000);
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets);

        expect(result.paye.toNumber()).toBe(18000); // 100000 * 0.18
        expect(result.trace).toHaveLength(1);
        expect(result.trace[0].step).toBe('bracket_calculation');
      });

      it('should calculate PAYE for second bracket (26%)', () => {
        const taxableIncome = new Decimal(300000);
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets);

        // Base tax (42678) + (300000 - 237101) * 0.26
        const expectedPaye = 42678 + (300000 - 237101) * 0.26;
        expect(result.paye.toNumber()).toBeCloseTo(expectedPaye, 2);
        expect(result.trace[0].bracket.rate).toBe(0.26);
      });

      it('should calculate PAYE for top bracket (45%)', () => {
        const taxableIncome = new Decimal(2000000);
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets);

        // Base tax (644489) + (2000000 - 1817001) * 0.45
        const expectedPaye = 644489 + (2000000 - 1817001) * 0.45;
        expect(result.paye.toNumber()).toBeCloseTo(expectedPaye, 2);
        expect(result.trace[0].bracket.rate).toBe(0.45);
      });

      it('should handle income at bracket boundaries', () => {
        const taxableIncome = new Decimal(237101); // Start of second bracket
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets);

        // Base tax (42678) + (237101 - 237101) * 0.26 = 42678
        expect(result.paye.toNumber()).toBeCloseTo(42678, 2);
      });

      it('should handle income exactly at bracket end', () => {
        const taxableIncome = new Decimal(370500); // End of second bracket
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets);

        // Base tax (42678) + (370500 - 237101) * 0.26
        const expectedPaye = 42678 + (370500 - 237101) * 0.26;
        expect(result.paye.toNumber()).toBeCloseTo(expectedPaye, 2);
      });
    });

    describe('tax credits and rebates', () => {
      it('should apply primary rebate (South Africa)', () => {
        const taxableIncome = new Decimal(300000);
        const meta = { primary_rebate: 17235 };
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets, meta);

        const payeBeforeRebate = 42678 + (300000 - 237101) * 0.26;
        const expectedPaye = Math.max(0, payeBeforeRebate - 17235);

        expect(result.paye.toNumber()).toBeCloseTo(expectedPaye, 2);
        expect(result.trace).toHaveLength(2);
        expect(result.trace[1].step).toBe('apply_primary_rebate');
        expect(result.trace[1].rebate).toBe(17235);
      });

      it('should apply tax credit (Lesotho)', () => {
        const taxableIncome = new Decimal(200000);
        const meta = { tax_credit: 5000 };
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets, meta);

        const payeBeforeCredit = 200000 * 0.18;
        const expectedPaye = Math.max(0, payeBeforeCredit - 5000);

        expect(result.paye.toNumber()).toBeCloseTo(expectedPaye, 2);
        expect(result.trace[1].step).toBe('apply_tax_credit');
      });

      it('should not allow negative PAYE after rebate', () => {
        const taxableIncome = new Decimal(50000);
        const meta = { primary_rebate: 20000 };
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets, meta);

        // PAYE would be 50000 * 0.18 = 9000, minus 20000 rebate = -11000, but should be 0
        expect(result.paye.toNumber()).toBe(0);
        expect(result.paye.isPositive() || result.paye.isZero()).toBe(true);
      });

      it('should apply multiple rebates (primary + secondary)', () => {
        const taxableIncome = new Decimal(200000);
        const meta = {
          primary_rebate: 17235,
          secondary_rebate: 9444, // Age 65+
        };
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets, meta);

        const payeBeforeRebates = 200000 * 0.18;
        const expectedPaye = Math.max(0, payeBeforeRebates - 17235 - 9444);

        expect(result.paye.toNumber()).toBeCloseTo(expectedPaye, 2);
        expect(result.trace.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('edge cases and validation', () => {
      it('should throw error for negative taxable income', () => {
        const taxableIncome = new Decimal(-1000);

        expect(() => {
          service.calculatePAYE(taxableIncome, southAfricaBrackets);
        }).toThrow(BadRequestException);
      });

      it('should throw error for NaN taxable income', () => {
        const taxableIncome = new Decimal(NaN);

        expect(() => {
          service.calculatePAYE(taxableIncome, southAfricaBrackets);
        }).toThrow(BadRequestException);
      });

      it('should throw error for empty brackets array', () => {
        const taxableIncome = new Decimal(100000);

        expect(() => {
          service.calculatePAYE(taxableIncome, []);
        }).toThrow(BadRequestException);
      });

      it('should throw error when no bracket matches (income too high)', () => {
        // Create brackets that don't cover the income
        const limitedBrackets: TaxBracket[] = [
          { from_amount: 0, to_amount: 100000, rate: 0.18, base_tax: 0 },
        ];
        const taxableIncome = new Decimal(200000);

        expect(() => {
          service.calculatePAYE(taxableIncome, limitedBrackets);
        }).toThrow(BadRequestException);
      });

      it('should handle zero taxable income', () => {
        const taxableIncome = new Decimal(0);
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets);

        expect(result.paye.toNumber()).toBe(0);
      });

      it('should handle income below first bracket threshold', () => {
        // Income that's less than the first bracket's from_amount
        const brackets: TaxBracket[] = [
          { from_amount: 50000, to_amount: 100000, rate: 0.18, base_tax: 0 },
        ];
        const taxableIncome = new Decimal(25000);

        expect(() => {
          service.calculatePAYE(taxableIncome, brackets);
        }).toThrow(BadRequestException);
      });

      it('should handle unsorted brackets (should sort internally)', () => {
        // Provide brackets in wrong order
        const unsortedBrackets: TaxBracket[] = [
          { from_amount: 237101, to_amount: 370500, rate: 0.26, base_tax: 42678 },
          { from_amount: 0, to_amount: 237100, rate: 0.18, base_tax: 0 },
        ];
        const taxableIncome = new Decimal(100000);

        // Should still work because brackets are sorted internally
        const result = service.calculatePAYE(taxableIncome, unsortedBrackets);
        expect(result.paye.toNumber()).toBe(18000);
      });
    });

    describe('bracket with null to_amount (unlimited upper bound)', () => {
      it('should handle unlimited upper bracket', () => {
        const brackets: TaxBracket[] = [
          { from_amount: 0, to_amount: 100000, rate: 0.18, base_tax: 0 },
          { from_amount: 100001, to_amount: null, rate: 0.45, base_tax: 50000 },
        ];
        const taxableIncome = new Decimal(500000);

        const result = service.calculatePAYE(taxableIncome, brackets);
        // Base tax (50000) + (500000 - 100001) * 0.45
        const expectedPaye = 50000 + (500000 - 100001) * 0.45;
        expect(result.paye.toNumber()).toBeCloseTo(expectedPaye, 2);
      });
    });

    describe('trace output', () => {
      it('should include bracket calculation in trace', () => {
        const taxableIncome = new Decimal(300000);
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets);

        expect(result.trace[0]).toMatchObject({
          step: 'bracket_calculation',
          bracket: expect.objectContaining({
            from: expect.any(Number),
            to: expect.any(Number),
            rate: expect.any(Number),
            base_tax: expect.any(Number),
          }),
        });
      });

      it('should include rebate steps in trace when meta provided', () => {
        const taxableIncome = new Decimal(200000);
        const meta = { primary_rebate: 17235 };
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets, meta);

        expect(result.trace.length).toBeGreaterThan(1);
        const rebateStep = result.trace.find((t) => t.step === 'apply_primary_rebate');
        expect(rebateStep).toBeDefined();
        expect(rebateStep).toMatchObject({
          rebate: 17235,
          paye_before: expect.any(Number),
          paye_after: expect.any(Number),
        });
      });
    });

    describe('complex scenarios', () => {
      it('should calculate PAYE for typical employee salary (R500k annual)', () => {
        const taxableIncome = new Decimal(500000);
        const meta = { primary_rebate: 17235 };
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets, meta);

        // Should be in 4th bracket (36%): base_tax (121475) + (500000 - 512801) * 0.36
        // Actually wait, 500000 is less than 512801, so it's in 3rd bracket
        // 3rd bracket: base_tax (77362) + (500000 - 370501) * 0.31
        const payeBeforeRebate = 77362 + (500000 - 370501) * 0.31;
        const expectedPaye = Math.max(0, payeBeforeRebate - 17235);

        expect(result.paye.toNumber()).toBeCloseTo(expectedPaye, 2);
      });

      it('should handle high-income earner (R2M annual)', () => {
        const taxableIncome = new Decimal(2000000);
        const meta = { primary_rebate: 17235 };
        const result = service.calculatePAYE(taxableIncome, southAfricaBrackets, meta);

        // Top bracket (45%): base_tax (644489) + (2000000 - 1817001) * 0.45
        const payeBeforeRebate = 644489 + (2000000 - 1817001) * 0.45;
        const expectedPaye = Math.max(0, payeBeforeRebate - 17235);

        expect(result.paye.toNumber()).toBeCloseTo(expectedPaye, 2);
      });
    });
  });

  describe('importTaxTable', () => {
    const validBrackets: TaxBracket[] = [
      { from_amount: 0, to_amount: 100000, rate: 0.18, base_tax: 0 },
      { from_amount: 100001, to_amount: 200000, rate: 0.26, base_tax: 18000 },
    ];

    beforeEach(() => {
      mockPrismaService.taxTable.findFirst.mockResolvedValue(null);
      mockPrismaService.taxTable.create.mockResolvedValue({
        id: 'test-id',
        country: 'ZA',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
      });
      // Reset $transaction mock
      mockPrismaService.$transaction.mockReset();
    });

    it('should import valid tax table', async () => {
      // Mock the transaction to return the created tax table
      const mockTaxTable = {
        id: 'test-id',
        country: 'ZA',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          taxTable: {
            create: jest.fn().mockResolvedValue(mockTaxTable),
          },
          taxBracket: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return await callback(mockTx);
      });

      const result = await service.importTaxTable(
        Country.ZA,
        '2025-01-01',
        null,
        validBrackets,
        null,
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toEqual({
        import_id: 'test-id',
        job_id: 'job_tax_import_test-id',
      });
    });

    it('should throw error for invalid date', async () => {
      await expect(
        service.importTaxTable(Country.ZA, 'invalid-date', null, validBrackets, null),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for empty brackets', async () => {
      await expect(
        service.importTaxTable(Country.ZA, '2025-01-01', null, [], null),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for negative from_amount', async () => {
      const invalidBrackets: TaxBracket[] = [
        { from_amount: -100, to_amount: 100000, rate: 0.18, base_tax: 0 },
      ];

      await expect(
        service.importTaxTable(Country.ZA, '2025-01-01', null, invalidBrackets, null),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for invalid tax rate (>1)', async () => {
      const invalidBrackets: TaxBracket[] = [
        { from_amount: 0, to_amount: 100000, rate: 1.5, base_tax: 0 },
      ];

      await expect(
        service.importTaxTable(Country.ZA, '2025-01-01', null, invalidBrackets, null),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for invalid tax rate (<0)', async () => {
      const invalidBrackets: TaxBracket[] = [
        { from_amount: 0, to_amount: 100000, rate: -0.1, base_tax: 0 },
      ];

      await expect(
        service.importTaxTable(Country.ZA, '2025-01-01', null, invalidBrackets, null),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when to_amount <= from_amount', async () => {
      const invalidBrackets: TaxBracket[] = [
        { from_amount: 100000, to_amount: 50000, rate: 0.18, base_tax: 0 },
      ];

      await expect(
        service.importTaxTable(Country.ZA, '2025-01-01', null, invalidBrackets, null),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when tax table already exists', async () => {
      mockPrismaService.taxTable.findFirst.mockResolvedValue({
        id: 'existing-id',
        country: 'ZA',
        effectiveFrom: new Date('2025-01-01'),
      });

      await expect(
        service.importTaxTable(Country.ZA, '2025-01-01', null, validBrackets, null),
      ).rejects.toThrow(ConflictException);
    });
  });
});
