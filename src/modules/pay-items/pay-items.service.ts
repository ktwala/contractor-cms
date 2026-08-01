import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CreatePayItemDto, UpdatePayItemDto } from './dto/create-pay-item.dto';
import { ListPayItemsDto } from './dto/list-pay-items.dto';
import { PayItemType, Country } from '../../common/dto/enums.dto';

@Injectable()
export class PayItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePayItemDto, userId?: string, reason?: string) {
    const existing = await this.prisma.payItem.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_CODE',
        message: `Pay item with code '${dto.code}' already exists`,
      });
    }

    // Validate pay group if specified
    if (dto.pay_group_id) {
      const payGroup = await this.prisma.payGroup.findUnique({
        where: { id: dto.pay_group_id },
      });
      if (!payGroup) {
        throw new NotFoundException({
          code: 'PAY_GROUP_NOT_FOUND',
          message: `Pay group '${dto.pay_group_id}' not found`,
        });
      }
    }

    const payItem = await this.prisma.payItem.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        category: dto.category,
        taxable: dto.taxable ?? true,
        glAccount: dto.gl_account,
        glAccountCredit: dto.gl_account_credit,
        sortOrder: dto.sort_order ?? 100,
        formula: dto.formula,
        formulaDeps: dto.formula_deps || [],
        countryAttributes: dto.country_attributes as any,
        payGroupId: dto.pay_group_id,
        isSystem: dto.is_system ?? false,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'PayItem',
      entityId: payItem.id,
      newValue: payItem as any,
      reason,
    });

    return this.mapToResponse(payItem);
  }

  async update(id: string, dto: UpdatePayItemDto, userId?: string, reason?: string) {
    const existing = await this.prisma.payItem.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Pay item with id '${id}' not found`,
      });
    }

    const oldValue = { ...existing };

    const payItem = await this.prisma.payItem.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        category: dto.category,
        taxable: dto.taxable,
        glAccount: dto.gl_account,
        glAccountCredit: dto.gl_account_credit,
        sortOrder: dto.sort_order,
        formula: dto.formula,
        formulaDeps: dto.formula_deps,
        countryAttributes: dto.country_attributes as any,
        isActive: dto.is_active,
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'PayItem',
      entityId: payItem.id,
      oldValue: oldValue as any,
      newValue: payItem as any,
      reason,
    });

    return this.mapToResponse(payItem);
  }

  async delete(id: string, userId?: string, reason?: string) {
    const existing = await this.prisma.payItem.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Pay item with id '${id}' not found`,
      });
    }

    if (existing.isSystem) {
      throw new BadRequestException({
        code: 'SYSTEM_ITEM',
        message: 'Cannot delete system pay items',
      });
    }

    // Check if pay item is in use
    const usageCount = await this.prisma.payLine.count({
      where: { payItemId: id },
    });

    if (usageCount > 0) {
      // Soft delete - mark as inactive
      const payItem = await this.prisma.payItem.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditService.log({
        userId,
        action: 'DEACTIVATE',
        entityType: 'PayItem',
        entityId: payItem.id,
        reason: reason || 'Pay item in use, deactivated instead of deleted',
      });

      return { deleted: false, deactivated: true, message: 'Pay item deactivated (in use)' };
    }

    // Hard delete
    await this.prisma.payItem.delete({
      where: { id },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entityType: 'PayItem',
      entityId: id,
      oldValue: existing as any,
      reason,
    });

    return { deleted: true, deactivated: false };
  }

  async findAll(query: ListPayItemsDto) {
    const where: any = {};

    if (!query.include_inactive) {
      where.isActive = true;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.pay_group_id) {
      where.OR = [
        { payGroupId: query.pay_group_id },
        { payGroupId: null }, // Include global items
      ];
    }

    const items = await this.prisma.payItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: {
        payGroup: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    let filteredItems = items;

    // Filter by country if specified
    if (query.country) {
      filteredItems = items.filter((item) => {
        const attrs = item.countryAttributes as any;
        if (!attrs) return true;
        return attrs[query.country!] !== undefined || Object.keys(attrs).length === 0;
      });
    }

    return {
      items: filteredItems.map((item) => this.mapToResponse(item)),
      total: filteredItems.length,
    };
  }

  async findOne(id: string) {
    const payItem = await this.prisma.payItem.findUnique({
      where: { id },
      include: {
        payGroup: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!payItem) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Pay item with id '${id}' not found`,
      });
    }

    return this.mapToResponse(payItem);
  }

  async findByCode(code: string) {
    const payItem = await this.prisma.payItem.findUnique({
      where: { code },
      include: {
        payGroup: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!payItem) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Pay item with code '${code}' not found`,
      });
    }

    return this.mapToResponse(payItem);
  }

  async findById(id: string) {
    const payItem = await this.prisma.payItem.findUnique({
      where: { id },
    });

    if (!payItem) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Pay item with id '${id}' not found`,
      });
    }

    return payItem;
  }

  /**
   * Get all pay items for a pay group (including global items)
   */
  async findForPayGroup(payGroupId: string) {
    const items = await this.prisma.payItem.findMany({
      where: {
        isActive: true,
        OR: [
          { payGroupId },
          { payGroupId: null },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    return items.map((item) => this.mapToResponse(item));
  }

  /**
   * Get pay items by type
   */
  async findByType(type: PayItemType) {
    const items = await this.prisma.payItem.findMany({
      where: { type, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    return items.map((item) => this.mapToResponse(item));
  }

  /**
   * Get country-specific attributes for a pay item
   */
  getCountryAttributes(payItem: any, country: Country) {
    const attrs = payItem.countryAttributes as any;
    if (!attrs) return { taxable: payItem.taxable };

    const countryAttrs = attrs[country];
    if (!countryAttrs) return { taxable: payItem.taxable };

    return {
      taxable: countryAttrs.taxable ?? payItem.taxable,
      ...countryAttrs,
    };
  }

  /**
   * Evaluate a formula for a pay item
   */
  evaluateFormula(formula: string, context: Record<string, number>): number {
    if (!formula) return 0;

    // Simple formula evaluator - supports basic math operations
    let expression = formula;

    // Replace variable names with values
    for (const [key, value] of Object.entries(context)) {
      expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString());
    }

    try {
      // Basic safe evaluation (only numbers and operators)
      if (!/^[\d\s+\-*/().]+$/.test(expression)) {
        throw new Error('Invalid formula');
      }
      return Function(`"use strict"; return (${expression})`)();
    } catch {
      return 0;
    }
  }

  private mapToResponse(payItem: any) {
    return {
      id: payItem.id,
      code: payItem.code,
      name: payItem.name,
      description: payItem.description,
      type: payItem.type as PayItemType,
      category: payItem.category,
      taxable: payItem.taxable,
      gl_account: payItem.glAccount,
      gl_account_credit: payItem.glAccountCredit,
      sort_order: payItem.sortOrder,
      formula: payItem.formula,
      formula_deps: payItem.formulaDeps,
      country_attributes: payItem.countryAttributes,
      is_active: payItem.isActive,
      is_system: payItem.isSystem,
      pay_group: payItem.payGroup || null,
      created_at: payItem.createdAt.toISOString(),
      updated_at: payItem.updatedAt.toISOString(),
    };
  }
}
