import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { ListRulesDto } from './dto/list-rules.dto';
import { Country, RoundingMode } from '../../common/dto/enums.dto';
import { format } from 'date-fns';

@Injectable()
export class RulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateRuleDto, userId?: string, reason?: string) {
    const existing = await this.prisma.rule.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_CODE',
        message: `Rule with code '${dto.code}' already exists`,
      });
    }

    const rule = await this.prisma.rule.create({
      data: {
        code: dto.code,
        name: dto.name,
        country: dto.country,
        expression: dto.expression,
        dependencies: dto.dependencies || [],
        rounding: dto.rounding as any,
        effectiveFrom: new Date(dto.effective_from),
        effectiveTo: dto.effective_to ? new Date(dto.effective_to) : null,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'Rule',
      entityId: rule.id,
      newValue: rule as any,
      reason,
    });

    return this.mapToResponse(rule);
  }

  async findAll(query: ListRulesDto) {
    const where: any = {};

    if (query.country) {
      where.OR = [
        { country: query.country },
        { country: null }, // Global rules
      ];
    }

    if (query.effective_on) {
      const date = new Date(query.effective_on);
      where.effectiveFrom = { lte: date };
      where.AND = [
        {
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: date } },
          ],
        },
      ];
    }

    const rules = await this.prisma.rule.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    return {
      items: rules.map(this.mapToResponse),
    };
  }

  async findByCode(code: string) {
    const rule = await this.prisma.rule.findUnique({
      where: { code },
    });

    if (!rule) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Rule with code '${code}' not found`,
      });
    }

    return this.mapToResponse(rule);
  }

  /**
   * Get all rules applicable for a country at a specific date
   */
  async getEffectiveRules(country: Country, effectiveDate: Date) {
    const rules = await this.prisma.rule.findMany({
      where: {
        AND: [
          {
            OR: [
              { country },
              { country: null }, // Global rules
            ],
          },
          {
            effectiveFrom: { lte: effectiveDate },
          },
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: effectiveDate } },
            ],
          },
        ],
      },
      orderBy: { code: 'asc' },
    });

    return rules;
  }

  private mapToResponse(rule: any) {
    return {
      id: rule.id,
      code: rule.code,
      name: rule.name,
      country: rule.country as Country | null,
      expression: rule.expression,
      dependencies: rule.dependencies,
      rounding: rule.rounding,
      effective_from: format(rule.effectiveFrom, 'yyyy-MM-dd'),
      effective_to: rule.effectiveTo ? format(rule.effectiveTo, 'yyyy-MM-dd') : null,
      created_at: rule.createdAt.toISOString(),
    };
  }
}
