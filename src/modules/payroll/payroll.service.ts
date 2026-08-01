import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Country, Currency, PayFrequency } from '@prisma/client';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async getReferenceData() {
    const [payGroups, payItems] = await Promise.all([
      this.prisma.payGroup.findMany({ select: { code: true, name: true, country: true } }),
      this.prisma.payItem.findMany({
        where: { isActive: true },
        select: { code: true, name: true, type: true, category: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const earningComponentCodes = payItems
      .filter((p) => p.type === 'EARNING')
      .map((p) => p.code);
    
    const deductionCodes = payItems
      .filter((p) => p.type === 'DEDUCTION')
      .map((p) => p.code);

    return {
      payGroups: payGroups.map((p) => p.code),
      payItems: payItems.map((p) => p.code),
      deductionCodes,
      earningComponentCodes,
      payrollStatuses: ['ELIGIBLE', 'HOLD', 'EXCLUDED'],
      frequencies: Object.values(PayFrequency),
      currencies: Object.values(Currency),
      countries: Object.values(Country),
      residencyStatuses: ['RESIDENT', 'NON_RESIDENT'],
    };
  }
}
