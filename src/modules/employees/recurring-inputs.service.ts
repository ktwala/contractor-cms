import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { format, parseISO, isWithinInterval, startOfDay } from 'date-fns';
import { CreateRecurringInputDto, RecurringInputResponseDto } from './dto/effective-dated.dto';
import { Currency } from '../../common/dto/enums.dto';

@Injectable()
export class RecurringInputsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listForEmployee(employeeId: string, includeInactive = false) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    const where: any = { employeeId };
    if (!includeInactive) {
      where.isActive = true;
    }

    const recurringInputs = await this.prisma.recurringInput.findMany({
      where,
      include: { payItem: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: recurringInputs.map((ri) => ({
        id: ri.id,
        employee_id: ri.employeeId,
        pay_item_code: ri.payItem.code,
        pay_item_name: ri.payItem.name,
        amount: Number(ri.amount),
        currency: ri.currency,
        start_date: format(ri.startDate, 'yyyy-MM-dd'),
        end_date: ri.endDate ? format(ri.endDate, 'yyyy-MM-dd') : null,
        meta: ri.meta,
        is_active: ri.isActive,
        created_at: ri.createdAt.toISOString(),
      })),
    };
  }

  async create(
    employeeId: string,
    dto: CreateRecurringInputDto,
    userId?: string,
    reason?: string,
  ): Promise<RecurringInputResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        employments: {
          where: { effectiveTo: null },
          take: 1,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    // Get current employment to determine pay group for pay item lookup
    const currentEmployment = employee.employments[0];
    if (!currentEmployment) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_EMPLOYMENT',
        message: 'Employee has no active employment',
      });
    }

    // Look up pay item by code
    const payItem = await this.prisma.payItem.findFirst({
      where: { code: dto.pay_item_code },
    });

    if (!payItem) {
      throw new NotFoundException({
        code: 'PAY_ITEM_NOT_FOUND',
        message: `Pay item with code '${dto.pay_item_code}' not found`,
      });
    }

    const startDate = parseISO(dto.start_date);
    const endDate = dto.end_date ? parseISO(dto.end_date) : null;

    if (endDate && endDate < startDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'End date must be after start date',
      });
    }

    const recurringInput = await this.prisma.recurringInput.create({
      data: {
        employeeId,
        payItemId: payItem.id,
        amount: dto.amount,
        currency: dto.currency || 'ZAR',
        startDate,
        endDate,
        meta: dto.meta,
        isActive: true,
      },
      include: { payItem: true },
    });

    if (userId) {
      await this.auditService.log({
        action: 'RECURRING_INPUT_CREATED',
        entityType: 'recurring_input',
        entityId: recurringInput.id,
        userId,
        reason,
        newValue: {
          pay_item_code: dto.pay_item_code,
          amount: dto.amount,
          start_date: dto.start_date,
        },
      });
    }

    return {
      id: recurringInput.id,
      employee_id: recurringInput.employeeId,
      pay_item_code: recurringInput.payItem.code,
      amount: Number(recurringInput.amount),
      currency: recurringInput.currency as Currency,
      start_date: format(recurringInput.startDate, 'yyyy-MM-dd'),
      end_date: recurringInput.endDate
        ? format(recurringInput.endDate, 'yyyy-MM-dd')
        : null,
      meta: recurringInput.meta as any,
      is_active: recurringInput.isActive,
      created_at: recurringInput.createdAt.toISOString(),
    };
  }

  async deactivate(
    employeeId: string,
    recurringInputId: string,
    userId?: string,
    reason?: string,
  ) {
    const recurringInput = await this.prisma.recurringInput.findFirst({
      where: {
        id: recurringInputId,
        employeeId,
      },
    });

    if (!recurringInput) {
      throw new NotFoundException({
        code: 'RECURRING_INPUT_NOT_FOUND',
        message: `Recurring input '${recurringInputId}' not found for employee '${employeeId}'`,
      });
    }

    const updated = await this.prisma.recurringInput.update({
      where: { id: recurringInputId },
      data: { isActive: false },
      include: { payItem: true },
    });

    if (userId) {
      await this.auditService.log({
        action: 'RECURRING_INPUT_DEACTIVATED',
        entityType: 'recurring_input',
        entityId: recurringInput.id,
        userId,
        reason,
        oldValue: { is_active: true },
        newValue: { is_active: false },
      });
    }

    return {
      id: updated.id,
      employee_id: updated.employeeId,
      pay_item_code: updated.payItem.code,
      amount: Number(updated.amount),
      currency: updated.currency,
      start_date: format(updated.startDate, 'yyyy-MM-dd'),
      end_date: updated.endDate ? format(updated.endDate, 'yyyy-MM-dd') : null,
      is_active: updated.isActive,
    };
  }

  /**
   * Get all active recurring inputs for an employee that apply on a given date
   * Used during payrun calculation
   */
  async getActiveForDate(employeeId: string, asOfDate: Date) {
    const date = startOfDay(asOfDate);

    const recurringInputs = await this.prisma.recurringInput.findMany({
      where: {
        employeeId,
        isActive: true,
        startDate: { lte: date },
        OR: [
          { endDate: null },
          { endDate: { gte: date } },
        ],
      },
      include: { payItem: true },
    });

    return recurringInputs.map((ri) => ({
      id: ri.id,
      pay_item_id: ri.payItemId,
      pay_item_code: ri.payItem.code,
      pay_item_type: ri.payItem.type,
      amount: Number(ri.amount),
      currency: ri.currency,
      meta: ri.meta,
    }));
  }
}
