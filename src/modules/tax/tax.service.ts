import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { Country } from '../../common/dto/enums.dto';
import { format } from 'date-fns';
import Decimal from 'decimal.js';

export interface TaxBracket {
  from_amount: number;
  to_amount: number | null;
  rate: number;
  base_tax: number | null;
}

export interface TaxTableWithBrackets {
  country: Country;
  effective_from: string;
  effective_to: string | null;
  brackets: TaxBracket[];
  meta: Record<string, any> | null;
}

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async importTaxTable(
    country: Country,
    effectiveFrom: string,
    effectiveTo: string | null,
    brackets: TaxBracket[],
    meta: Record<string, any> | null,
    userId?: string,
    reason?: string,
  ) {
    const effectiveFromDate = new Date(effectiveFrom);

    if (isNaN(effectiveFromDate.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: `Invalid effective from date: ${effectiveFrom}`,
        details: { providedDate: effectiveFrom },
      });
    }

    if (!brackets || brackets.length === 0) {
      throw new BadRequestException({
        code: 'NO_BRACKETS',
        message: 'Tax table must have at least one bracket',
        details: { country, effectiveFrom },
      });
    }

    // Validate brackets
    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      if (bracket.from_amount < 0) {
        throw new BadRequestException({
          code: 'INVALID_BRACKET',
          message: `Bracket ${i} has negative from_amount: ${bracket.from_amount}`,
          details: { bracketIndex: i, bracket },
        });
      }
      if (bracket.rate < 0 || bracket.rate > 1) {
        throw new BadRequestException({
          code: 'INVALID_TAX_RATE',
          message: `Bracket ${i} has invalid rate (must be between 0 and 1): ${bracket.rate}`,
          details: { bracketIndex: i, bracket },
        });
      }
      if (bracket.to_amount !== null && bracket.to_amount <= bracket.from_amount) {
        throw new BadRequestException({
          code: 'INVALID_BRACKET_RANGE',
          message: `Bracket ${i} has to_amount <= from_amount`,
          details: { bracketIndex: i, bracket },
        });
      }
    }

    // Check for existing table at same effective date
    const existing = await this.prisma.taxTable.findFirst({
      where: {
        country,
        effectiveFrom: effectiveFromDate,
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'TAX_TABLE_EXISTS',
        message: `Tax table for ${country} effective from ${effectiveFrom} already exists`,
      });
    }

    // Create tax table with brackets in a transaction
    let taxTable;
    try {
      taxTable = await this.prisma.$transaction(async (tx) => {
        const table = await tx.taxTable.create({
          data: {
            country,
            effectiveFrom: effectiveFromDate,
            effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
            meta: meta as any,
          },
        });

        // Create brackets sequentially to ensure proper ordering
        for (let i = 0; i < brackets.length; i++) {
          const bracket = brackets[i];
          await tx.taxBracket.create({
            data: {
              taxTableId: table.id,
              fromAmount: bracket.from_amount,
              toAmount: bracket.to_amount,
              rate: bracket.rate,
              baseTax: bracket.base_tax,
              sortOrder: i,
            },
          });
        }

        return table;
      });
    } catch (error) {
      throw new BadRequestException({
        code: 'TAX_TABLE_IMPORT_FAILED',
        message: `Failed to import tax table: ${error.message}`,
        details: { country, effectiveFrom, bracketCount: brackets.length },
      });
    }

    await this.auditService.log({
      userId,
      action: 'IMPORT_TAX_TABLE',
      entityType: 'TaxTable',
      entityId: taxTable.id,
      newValue: { country, effectiveFrom, bracketCount: brackets.length },
      reason,
    });

    return {
      job_id: `job_tax_import_${taxTable.id}`,
      import_id: taxTable.id,
    };
  }

  async getTaxTable(country: Country, effectiveOn: string): Promise<TaxTableWithBrackets> {
    const date = new Date(effectiveOn);

    const taxTable = await this.prisma.taxTable.findFirst({
      where: {
        country,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      include: {
        brackets: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!taxTable) {
      throw new NotFoundException({
        code: 'TAX_TABLE_NOT_FOUND',
        message: `No tax table found for ${country} effective on ${effectiveOn}`,
      });
    }

    return {
      country: taxTable.country as Country,
      effective_from: format(taxTable.effectiveFrom, 'yyyy-MM-dd'),
      effective_to: taxTable.effectiveTo ? format(taxTable.effectiveTo, 'yyyy-MM-dd') : null,
      brackets: taxTable.brackets.map((b) => ({
        from_amount: Number(b.fromAmount),
        to_amount: b.toAmount ? Number(b.toAmount) : null,
        rate: Number(b.rate),
        base_tax: b.baseTax ? Number(b.baseTax) : null,
      })),
      meta: taxTable.meta as Record<string, any> | null,
    };
  }

  /**
   * Calculate PAYE tax based on taxable income using tax brackets
   */
  calculatePAYE(
    taxableIncome: Decimal,
    brackets: TaxBracket[],
    meta?: Record<string, any>,
  ): { paye: Decimal; trace: any[] } {
    const trace: any[] = [];
    let paye = new Decimal(0);

    // Validate inputs
    if (!taxableIncome || taxableIncome.isNaN()) {
      throw new BadRequestException({
        code: 'INVALID_TAXABLE_INCOME',
        message: 'Taxable income is invalid or NaN',
        details: { taxableIncome: String(taxableIncome) },
      });
    }

    if (taxableIncome.isNegative()) {
      throw new BadRequestException({
        code: 'NEGATIVE_TAXABLE_INCOME',
        message: 'Taxable income cannot be negative',
        details: { taxableIncome: taxableIncome.toNumber() },
      });
    }

    if (!brackets || brackets.length === 0) {
      throw new BadRequestException({
        code: 'NO_TAX_BRACKETS',
        message: 'No tax brackets provided for PAYE calculation',
      });
    }

    // Find applicable bracket
    const sortedBrackets = [...brackets].sort((a, b) => a.from_amount - b.from_amount);

    let bracketFound = false;
    for (const bracket of sortedBrackets) {
      try {
        const fromAmount = new Decimal(bracket.from_amount);
        const toAmount = bracket.to_amount !== null ? new Decimal(bracket.to_amount) : null;

        if (taxableIncome.lt(fromAmount)) {
          continue;
        }

        // Check if taxable income falls within this bracket
        if (toAmount === null || taxableIncome.lte(toAmount)) {
          // This is the applicable bracket
          const taxableInBracket = taxableIncome.minus(fromAmount);
          const rate = new Decimal(bracket.rate);
          const baseTax = bracket.base_tax !== null ? new Decimal(bracket.base_tax) : new Decimal(0);

          if (rate.isNaN() || rate.isNegative() || rate.greaterThan(1)) {
            throw new Error(`Invalid tax rate: ${bracket.rate}`);
          }

          paye = baseTax.plus(taxableInBracket.times(rate));

          if (paye.isNaN() || !paye.isFinite()) {
            throw new Error(`PAYE calculation resulted in invalid value: ${paye}`);
          }

          trace.push({
            step: 'bracket_calculation',
            bracket: {
              from: fromAmount.toNumber(),
              to: toAmount?.toNumber() || 'unlimited',
              rate: rate.toNumber(),
              base_tax: baseTax.toNumber(),
            },
            taxable_in_bracket: taxableInBracket.toNumber(),
            calculated_paye: paye.toNumber(),
          });

          bracketFound = true;
          break;
        }
      } catch (error) {
        throw new BadRequestException({
          code: 'BRACKET_CALCULATION_ERROR',
          message: `Error calculating PAYE for bracket: ${error.message}`,
          details: { bracket },
        });
      }
    }

    if (!bracketFound && taxableIncome.greaterThan(0)) {
      throw new BadRequestException({
        code: 'NO_APPLICABLE_BRACKET',
        message: `No tax bracket found for taxable income: ${taxableIncome.toNumber()}`,
        details: {
          taxableIncome: taxableIncome.toNumber(),
          bracketCount: brackets.length,
        },
      });
    }

    // Apply any credits/rebates from meta
    if (meta) {
      // Lesotho: Apply tax credit
      if (meta.tax_credit) {
        const credit = new Decimal(meta.tax_credit);
        const payeBeforeCredit = paye;
        paye = Decimal.max(paye.minus(credit), new Decimal(0));
        trace.push({
          step: 'apply_tax_credit',
          credit: credit.toNumber(),
          paye_before: payeBeforeCredit.toNumber(),
          paye_after: paye.toNumber(),
        });
      }

      // South Africa: Apply primary rebate
      if (meta.primary_rebate) {
        const rebate = new Decimal(meta.primary_rebate);
        const payeBeforeRebate = paye;
        paye = Decimal.max(paye.minus(rebate), new Decimal(0));
        trace.push({
          step: 'apply_primary_rebate',
          rebate: rebate.toNumber(),
          paye_before: payeBeforeRebate.toNumber(),
          paye_after: paye.toNumber(),
        });
      }

      // South Africa: Apply secondary rebate (age 65+)
      if (meta.secondary_rebate) {
        const rebate = new Decimal(meta.secondary_rebate);
        const payeBeforeRebate = paye;
        paye = Decimal.max(paye.minus(rebate), new Decimal(0));
        trace.push({
          step: 'apply_secondary_rebate',
          rebate: rebate.toNumber(),
          paye_before: payeBeforeRebate.toNumber(),
          paye_after: paye.toNumber(),
        });
      }
    }

    return { paye, trace };
  }

  /**
   * Get the tax table ID for snapshot purposes
   */
  async getTaxTableForSnapshot(country: Country, effectiveDate: Date) {
    const taxTable = await this.prisma.taxTable.findFirst({
      where: {
        country,
        effectiveFrom: { lte: effectiveDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!taxTable) {
      throw new NotFoundException({
        code: 'TAX_TABLE_NOT_FOUND',
        message: `No tax table found for ${country} effective on ${format(effectiveDate, 'yyyy-MM-dd')}`,
      });
    }

    return {
      effective_from: format(taxTable.effectiveFrom, 'yyyy-MM-dd'),
      effective_to: taxTable.effectiveTo ? format(taxTable.effectiveTo, 'yyyy-MM-dd') : null,
      table_id: taxTable.id,
        meta: taxTable.meta as any,
    };
  }
}
