import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import {
  PayrunExceptionType,
  PayrunExceptionSeverity,
  PayrunExceptionStatus,
  PayrunExceptionResolutionType,
} from '@prisma/client';
import { getExceptionRule } from './payrun-exception.rules';

export interface PayrunExceptionSummary {
  openTotal: number;
  criticalOpen: number;
  highOpen: number;
  mediumOpen: number;
  lowOpen: number;
  blockingSubmissionCount: number;
  blockingPaymentCount: number;
}

export interface DetectionResult {
  detected: number;
  updated: number;
  resolved: number;
  summary: PayrunExceptionSummary;
}

@Injectable()
export class PayrunExceptionService {
  private readonly logger = new Logger(PayrunExceptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async detectCalculationExceptions(payrunId: string): Promise<DetectionResult> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payRunEmployees: { where: { included: true }, include: { employee: { include: { bankAccounts: true, taxProfiles: true, employments: true } } } },
        employeeResults: true,
        payGroup: true,
      },
    });

    if (!payrun) throw new NotFoundException('Payrun not found');

    let detected = 0;
    let updated = 0;

    const resultMap = new Map(payrun.employeeResults.map(r => [r.employeeId, r]));

    for (const pre of payrun.payRunEmployees) {
      const emp = pre.employee;
      const result = resultMap.get(emp.id);

      if (!emp.bankAccounts || emp.bankAccounts.length === 0) {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.MISSING_BANK_DETAILS,
          'Missing bank details', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has no bank account on file.`);
        r === 'created' ? detected++ : updated++;
      }

      const activeTaxProfile = emp.taxProfiles?.find(tp => !(tp as any).endDate || new Date((tp as any).endDate) > new Date());
      if (!activeTaxProfile && emp.country === 'ZA') {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.MISSING_TAX_NUMBER,
          'Missing tax number', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has no active tax profile.`);
        r === 'created' ? detected++ : updated++;
      }

      if (result && Number(result.net) < 0) {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.NEGATIVE_NET_PAY,
          'Negative net pay', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has negative net pay of ${Number(result.net).toFixed(2)}.`);
        r === 'created' ? detected++ : updated++;
      }

      if (result && Number(result.net) === 0 && Number(result.gross) > 0) {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.ZERO_NET_PAY_UNEXPECTED,
          'Zero net pay with positive gross', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has zero net pay despite positive gross earnings.`);
        r === 'created' ? detected++ : updated++;
      }

      if (result && Number(result.deductionsTotal) > Number(result.gross)) {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.INVALID_DEDUCTION_TOTAL,
          'Deductions exceed gross', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has deductions (${Number(result.deductionsTotal).toFixed(2)}) exceeding gross (${Number(result.gross).toFixed(2)}).`);
        r === 'created' ? detected++ : updated++;

        const r2 = await this.upsertException(payrunId, emp.id, PayrunExceptionType.DEDUCTIONS_EXCEED_GROSS,
          'Deductions exceed gross pay', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}): total deductions exceed gross earnings.`);
        r2 === 'created' ? detected++ : updated++;
      }

      if (emp.status === 'ON_LEAVE') {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.ON_LEAVE_EMPLOYEE_INCLUDED,
          'On-leave employee included', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) is on unpaid leave but included in payrun.`);
        r === 'created' ? detected++ : updated++;
      }

      if (emp.status === 'TERMINATED' || (emp.terminationDate && new Date(emp.terminationDate) <= new Date())) {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.TERMINATED_EMPLOYEE_INCLUDED,
          'Terminated employee included', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) is terminated but included in payrun.`);
        r === 'created' ? detected++ : updated++;
      }

      if (!emp.employments || emp.employments.length === 0) {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.MISSING_EMPLOYMENT_ASSIGNMENT,
          'Missing employment assignment', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has no employment record.`);
        r === 'created' ? detected++ : updated++;
      }

      // Tax profile check (all countries)
      if (!emp.taxProfiles || emp.taxProfiles.length === 0) {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.MISSING_TAX_PROFILE,
          'Missing tax profile', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has no tax profile on file.`);
        r === 'created' ? detected++ : updated++;
      }

      // Bank verification check
      const verifiedBank = emp.bankAccounts?.find((ba: any) => ba.verificationStatus === 'VERIFIED' && !ba.effectiveTo);
      if (emp.bankAccounts?.length > 0 && !verifiedBank) {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.MISSING_BANK_VERIFICATION,
          'Bank account not verified', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has no verified bank account.`);
        r === 'created' ? detected++ : updated++;
      }

      // Identification check
      if (!(emp as any).idNumber && !(emp as any).passportNumber) {
        const r = await this.upsertException(payrunId, emp.id, PayrunExceptionType.MISSING_IDENTIFICATION,
          'Missing identification', `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo}) has no ID number or passport number on file.`);
        r === 'created' ? detected++ : updated++;
      }
    }

    // Check for duplicates
    const empCounts = new Map<string, number>();
    for (const pre of payrun.payRunEmployees) {
      empCounts.set(pre.employeeId, (empCounts.get(pre.employeeId) ?? 0) + 1);
    }
    for (const [empId, count] of empCounts) {
      if (count > 1) {
        const emp = payrun.payRunEmployees.find(p => p.employeeId === empId)?.employee;
        const r = await this.upsertException(payrunId, empId, PayrunExceptionType.DUPLICATE_EMPLOYEE_IN_RUN,
          'Duplicate employee in run', `Employee ${emp?.firstName ?? ''} ${emp?.lastName ?? ''} appears ${count} times in payrun.`);
        r === 'created' ? detected++ : updated++;
      }
    }

    const resolved = await this.autoResolveCleared(payrunId, payrun.payRunEmployees, resultMap);
    const summary = await this.getExceptionSummary(payrunId);

    this.logger.log(`Payrun ${payrunId}: detected=${detected}, updated=${updated}, autoResolved=${resolved}`);
    return { detected, updated, resolved, summary };
  }

  private async upsertException(
    payrunId: string,
    employeeId: string | null,
    type: PayrunExceptionType,
    title: string,
    description: string,
  ): Promise<'created' | 'updated'> {
    const rule = getExceptionRule(type);
    const existing = await this.prisma.payrunException.findFirst({
      where: {
        payrunId,
        employeeId: employeeId ?? undefined,
        type,
        status: { in: ['OPEN', 'ASSIGNED'] },
      },
    });

    if (existing) {
      await this.prisma.payrunException.update({
        where: { id: existing.id },
        data: { description, updatedAt: new Date() },
      });
      return 'updated';
    }

    const created = await this.prisma.payrunException.create({
      data: {
        payrunId,
        employeeId,
        code: type,
        type,
        severity: rule.severity,
        title,
        description,
        blocksSubmission: rule.blocksSubmission,
        blocksPayment: rule.blocksPayment,
      },
    });

    await this.auditService.log({
      userId: undefined,
      action: 'EXCEPTION_DETECTED',
      entityType: 'PayrunException',
      entityId: created.id,
      newValue: {
        payrunId,
        exceptionType: type,
        employeeId,
        severity: rule.severity,
        detectedByType: 'SYSTEM',
      },
    });

    return 'created';
  }

  private async autoResolveCleared(payrunId: string, employees: any[], resultMap: Map<string, any>): Promise<number> {
    const openExceptions = await this.prisma.payrunException.findMany({
      where: { payrunId, status: { in: ['OPEN', 'ASSIGNED'] } },
    });

    let resolved = 0;
    for (const exc of openExceptions) {
      let shouldResolve = false;

      if (exc.type === 'NEGATIVE_NET_PAY' && exc.employeeId) {
        const result = resultMap.get(exc.employeeId);
        if (result && Number(result.net) >= 0) shouldResolve = true;
      }

      if (exc.type === 'ZERO_NET_PAY_UNEXPECTED' && exc.employeeId) {
        const result = resultMap.get(exc.employeeId);
        if (result && Number(result.net) !== 0) shouldResolve = true;
      }

      if (exc.type === 'INVALID_DEDUCTION_TOTAL' && exc.employeeId) {
        const result = resultMap.get(exc.employeeId);
        if (result && Number(result.deductionsTotal) <= Number(result.gross)) shouldResolve = true;
      }

      if (shouldResolve) {
        await this.prisma.payrunException.update({
          where: { id: exc.id },
          data: {
            status: 'RESOLVED',
            resolutionType: 'NOT_APPLICABLE',
            resolutionNote: 'Auto-resolved: condition no longer present after recalculation.',
            resolvedAt: new Date(),
          },
        });
        resolved++;
      }
    }
    return resolved;
  }

  async listPayrunExceptions(payrunId: string, filters: {
    severity?: string; status?: string; type?: string;
    ownerUserId?: string; employeeId?: string; blockingOnly?: boolean;
  }) {
    const where: any = { payrunId };
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.ownerUserId) where.ownerUserId = filters.ownerUserId;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.blockingOnly) {
      where.OR = [{ blocksSubmission: true }, { blocksPayment: true }];
      where.status = { in: ['OPEN', 'ASSIGNED'] };
    }

    const items = await this.prisma.payrunException.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } } },
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
    });

    const summary = await this.getExceptionSummary(payrunId);

    return {
      items: items.map(e => ({
        id: e.id,
        employeeId: e.employeeId,
        employeeName: e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : null,
        employeeNo: e.employee?.employeeNo ?? null,
        code: e.code,
        type: e.type,
        severity: e.severity,
        status: e.status,
        title: e.title,
        description: e.description,
        ownerUserId: e.ownerUserId,
        blocksSubmission: e.blocksSubmission,
        blocksPayment: e.blocksPayment,
        detectedAt: e.detectedAt.toISOString(),
        resolvedAt: e.resolvedAt?.toISOString() ?? null,
        dismissedAt: e.dismissedAt?.toISOString() ?? null,
        resolutionType: e.resolutionType,
        resolutionNote: e.resolutionNote,
        dismissalReason: e.dismissalReason,
      })),
      summary,
    };
  }

  async getExceptionSummary(payrunId: string): Promise<PayrunExceptionSummary> {
    const openExceptions = await this.prisma.payrunException.findMany({
      where: { payrunId, status: { in: ['OPEN', 'ASSIGNED'] } },
      select: { severity: true, blocksSubmission: true, blocksPayment: true },
    });

    return {
      openTotal: openExceptions.length,
      criticalOpen: openExceptions.filter(e => e.severity === 'CRITICAL').length,
      highOpen: openExceptions.filter(e => e.severity === 'HIGH').length,
      mediumOpen: openExceptions.filter(e => e.severity === 'MEDIUM').length,
      lowOpen: openExceptions.filter(e => e.severity === 'LOW').length,
      blockingSubmissionCount: openExceptions.filter(e => e.blocksSubmission).length,
      blockingPaymentCount: openExceptions.filter(e => e.blocksPayment).length,
    };
  }

  async hasSubmissionBlockers(payrunId: string): Promise<boolean> {
    const count = await this.prisma.payrunException.count({
      where: { payrunId, blocksSubmission: true, status: { in: ['OPEN', 'ASSIGNED'] } },
    });
    return count > 0;
  }

  async hasPaymentBlockers(payrunId: string): Promise<boolean> {
    const count = await this.prisma.payrunException.count({
      where: { payrunId, blocksPayment: true, status: { in: ['OPEN', 'ASSIGNED'] } },
    });
    return count > 0;
  }

  async listGlobalExceptions(filters: {
    severity?: string; status?: string; type?: string; ownerUserId?: string;
    blockingOnly?: boolean; myAssignedOnly?: boolean; actorUserId?: string;
    page?: number; pageSize?: number;
  }) {
    const where: any = {};
    if (!filters.status) {
      where.status = { in: ['OPEN', 'ASSIGNED'] };
    } else {
      where.status = filters.status;
    }
    if (filters.severity) where.severity = filters.severity;
    if (filters.type) where.type = filters.type;
    if (filters.ownerUserId) where.ownerUserId = filters.ownerUserId;
    if (filters.myAssignedOnly && filters.actorUserId) where.ownerUserId = filters.actorUserId;
    if (filters.blockingOnly) {
      where.OR = [{ blocksSubmission: true }, { blocksPayment: true }];
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;

    const [items, total] = await Promise.all([
      this.prisma.payrunException.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
          payrun: { select: { id: true, status: true, periodStart: true, periodEnd: true, payGroupId: true, payGroup: { select: { name: true, country: true, legalEntityId: true, legalEntity: { select: { name: true } } } } } },
        },
        orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payrunException.count({ where }),
    ]);

    const mappedItems = items.map(e => ({
      id: e.id,
      payrunId: e.payrunId,
      payrunName: e.payrun?.payGroup?.name ? `${e.payrun.payGroup.name} ${e.payrun.periodStart ? new Date(e.payrun.periodStart).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : ''}` : e.payrunId,
      payrunStatus: e.payrun?.status ?? null,
      employeeId: e.employeeId,
      employeeName: e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : null,
      legalEntityName: e.payrun?.payGroup?.legalEntity?.name ?? null,
      payGroupName: e.payrun?.payGroup?.name ?? null,
      countryCode: e.payrun?.payGroup?.country ?? null,
      type: e.type, code: e.code, severity: e.severity, status: e.status,
      title: e.title, description: e.description,
      ownerUserId: e.ownerUserId,
      blocksSubmission: e.blocksSubmission, blocksPayment: e.blocksPayment,
      detectedAt: e.detectedAt.toISOString(),
      resolvedAt: e.resolvedAt?.toISOString() ?? null,
      dismissedAt: e.dismissedAt?.toISOString() ?? null,
    }));

    const summary = await this.getGlobalExceptionSummary(filters.actorUserId);

    return { items: mappedItems, summary, page, pageSize, total };
  }

  async getGlobalExceptionSummary(actorUserId?: string) {
    const openWhere = { status: { in: ['OPEN' as const, 'ASSIGNED' as const] } };
    const all = await this.prisma.payrunException.findMany({
      where: openWhere,
      select: { severity: true, blocksSubmission: true, blocksPayment: true, ownerUserId: true, payrunId: true },
    });

    const blockedPayruns = new Set(all.filter(e => e.blocksSubmission || e.blocksPayment).map(e => e.payrunId));

    return {
      openTotal: all.length,
      criticalOpen: all.filter(e => e.severity === 'CRITICAL').length,
      highOpen: all.filter(e => e.severity === 'HIGH').length,
      mediumOpen: all.filter(e => e.severity === 'MEDIUM').length,
      lowOpen: all.filter(e => e.severity === 'LOW').length,
      blockingSubmissionCount: all.filter(e => e.blocksSubmission).length,
      blockingPaymentCount: all.filter(e => e.blocksPayment).length,
      assignedToMeCount: actorUserId ? all.filter(e => e.ownerUserId === actorUserId).length : 0,
      blockedPayrunsCount: blockedPayruns.size,
    };
  }

  async assignException(exceptionId: string, actorUserId: string, ownerUserId: string) {
    const exc = await this.prisma.payrunException.findUnique({ where: { id: exceptionId } });
    if (!exc) throw new NotFoundException('Exception not found');
    if (!['OPEN', 'ASSIGNED'].includes(exc.status)) throw new BadRequestException('Exception is not in a state that can be assigned');

    const updated = await this.prisma.payrunException.update({
      where: { id: exceptionId },
      data: { status: 'ASSIGNED', ownerUserId },
    });

    await this.auditService.log({
      userId: actorUserId, action: 'EXCEPTION_ASSIGNED', entityType: 'PayrunException', entityId: exceptionId,
      newValue: { ownerUserId, payrunId: exc.payrunId },
    });

    return updated;
  }

  async resolveException(exceptionId: string, actorUserId: string, resolutionType: string, resolutionNote: string) {
    const exc = await this.prisma.payrunException.findUnique({ where: { id: exceptionId } });
    if (!exc) throw new NotFoundException('Exception not found');
    if (!['OPEN', 'ASSIGNED'].includes(exc.status)) throw new BadRequestException('Exception is not in a resolvable state');

    if (['CRITICAL', 'HIGH'].includes(exc.severity) && !resolutionNote?.trim()) {
      throw new BadRequestException('Resolution note is required for critical and high severity exceptions');
    }

    const updated = await this.prisma.payrunException.update({
      where: { id: exceptionId },
      data: {
        status: 'RESOLVED',
        resolutionType: resolutionType as PayrunExceptionResolutionType,
        resolutionNote,
        resolvedByUserId: actorUserId,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId: actorUserId, action: 'EXCEPTION_RESOLVED', entityType: 'PayrunException', entityId: exceptionId,
      newValue: { resolutionType, payrunId: exc.payrunId, exceptionType: exc.type },
    });

    return updated;
  }

  async dismissException(exceptionId: string, actorUserId: string, dismissalReason: string) {
    const exc = await this.prisma.payrunException.findUnique({ where: { id: exceptionId } });
    if (!exc) throw new NotFoundException('Exception not found');
    if (!['OPEN', 'ASSIGNED'].includes(exc.status)) throw new BadRequestException('Exception is not in a dismissable state');

    if (!dismissalReason?.trim()) {
      throw new BadRequestException('Dismissal reason is required');
    }

    const updated = await this.prisma.payrunException.update({
      where: { id: exceptionId },
      data: {
        status: 'DISMISSED',
        dismissedByUserId: actorUserId,
        dismissedAt: new Date(),
        dismissalReason,
      },
    });

    await this.auditService.log({
      userId: actorUserId, action: 'EXCEPTION_DISMISSED', entityType: 'PayrunException', entityId: exceptionId,
      newValue: { dismissalReason, payrunId: exc.payrunId, exceptionType: exc.type },
    });

    return updated;
  }
}
