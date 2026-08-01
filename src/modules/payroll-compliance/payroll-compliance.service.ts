import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

const REPORT_TYPES = ['EMP201', 'IRP5', 'EMP501', 'PAYE_RETURN_LS', 'EMPLOYEE_TAX_CERTIFICATE_LS', 'SOCIAL_CONTRIBUTION_REPORT_LS'];
const REPORT_STATUS = ['DRAFT', 'GENERATED', 'REVIEWED', 'APPROVED_FOR_SUBMISSION', 'SUBMITTED', 'FAILED'];
const SUBMISSION_STATUS = ['NOT_SUBMITTED', 'SUBMITTED', 'ACCEPTED', 'REJECTED'];

@Injectable()
export class PayrollComplianceService {
  private readonly logger = new Logger(PayrollComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listReports(filters: {
    countryCode?: string; reportType?: string;
    status?: string; submissionStatus?: string;
    page?: number; pageSize?: number;
  }) {
    const where: any = {};
    if (filters.countryCode) where.countryCode = filters.countryCode;
    if (filters.reportType) where.reportType = filters.reportType;
    if (filters.status) where.status = filters.status;
    if (filters.submissionStatus) where.submissionStatus = filters.submissionStatus;

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;

    const [items, total] = await Promise.all([
      this.prisma.payrollComplianceReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payrollComplianceReport.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getReport(id: string) {
    const report = await this.prisma.payrollComplianceReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async generateReport(payrunId: string, reportType: string, actorUserId?: string) {
    if (!REPORT_TYPES.includes(reportType)) {
      throw new ConflictException(`Invalid report type: ${reportType}`);
    }

    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: { include: { legalEntity: true } },
        employeeResults: true,
        payrunExceptions: { where: { status: { in: ['OPEN', 'ASSIGNED'] }, blocksPayment: true } },
      },
    });

    if (!payrun) throw new NotFoundException('Payrun not found');

    const paymentBlockingExceptions = payrun.payrunExceptions.length;
    if (paymentBlockingExceptions > 0) {
      throw new ConflictException({
        error: 'PRECONDITION_FAILED',
        message: 'Cannot generate compliance report: payment-blocking exceptions exist',
        blockers: [{ type: 'PAYMENT_BLOCKING_EXCEPTIONS_OPEN', count: paymentBlockingExceptions }],
      });
    }

    const results = payrun.employeeResults;
    const totals = results.reduce(
      (acc, r) => ({
        gross: acc.gross + Number(r.gross),
        paye: acc.paye + Number(r.paye),
        deductions: acc.deductions + Number(r.deductionsTotal),
        net: acc.net + Number(r.net),
        employeeCount: acc.employeeCount + 1,
      }),
      { gross: 0, paye: 0, deductions: 0, net: 0, employeeCount: 0 },
    );

    const countryCode = this.getCountryForReportType(reportType, payrun.payGroup.country);
    const periodName = payrun.periodStart
      ? new Date(payrun.periodStart).toLocaleDateString('en', { month: 'long', year: 'numeric' })
      : null;

    const reportData: any = {
      countryCode,
      legalEntityId: payrun.payGroup.legalEntityId,
      legalEntityName: payrun.payGroup.legalEntity?.name ?? null,
      payrunId,
      reportType,
      status: 'GENERATED',
      submissionStatus: 'NOT_SUBMITTED',
      generatedAt: new Date(),
      generatedByUserId: actorUserId ?? null,
      periodName,
      totals: {
        grossPay: totals.gross,
        paye: totals.paye,
        deductions: totals.deductions,
        netPay: totals.net,
        employeeCount: totals.employeeCount,
        uif: 0,
        sdl: 0,
        totalLiability: totals.paye,
      },
    };

    const report = await this.prisma.payrollComplianceReport.create({
      data: reportData,
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'COMPLIANCE_REPORT_GENERATED',
      entityType: 'PayrollComplianceReport',
      entityId: report.id,
      newValue: { reportType, payrunId, countryCode },
    });

    return report;
  }

  async submitReport(reportId: string, submissionReference: string, actorUserId?: string) {
    const report = await this.prisma.payrollComplianceReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    if (!['GENERATED', 'REVIEWED', 'APPROVED_FOR_SUBMISSION'].includes(report.status)) {
      throw new ConflictException('Report is not in a submittable state');
    }

    const updated = await this.prisma.payrollComplianceReport.update({
      where: { id: reportId },
      data: {
        status: 'SUBMITTED',
        submissionStatus: 'SUBMITTED',
        submittedAt: new Date(),
        submittedByUserId: actorUserId ?? null,
        submissionReference,
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'COMPLIANCE_REPORT_SUBMITTED',
      entityType: 'PayrollComplianceReport',
      entityId: reportId,
      newValue: { submissionReference },
    });

    return updated;
  }

  async updateReportStatus(
    reportId: string,
    status: string,
    authorityReference?: string,
    actorUserId?: string,
  ) {
    const report = await this.prisma.payrollComplianceReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
      throw new ConflictException('Status must be ACCEPTED or REJECTED');
    }

    if (report.submissionStatus !== 'SUBMITTED') {
      throw new ConflictException('Report must be in SUBMITTED state to update status');
    }

    const updated = await this.prisma.payrollComplianceReport.update({
      where: { id: reportId },
      data: {
        submissionStatus: status,
        ...(authorityReference ? { submissionReference: authorityReference } : {}),
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: status === 'ACCEPTED' ? 'COMPLIANCE_REPORT_ACCEPTED' : 'COMPLIANCE_REPORT_REJECTED',
      entityType: 'PayrollComplianceReport',
      entityId: reportId,
      oldValue: { submissionStatus: 'SUBMITTED' },
      newValue: { submissionStatus: status, authorityReference },
    });

    return updated;
  }

  private getCountryForReportType(reportType: string, payGroupCountry: string): string {
    if (['EMP201', 'IRP5', 'EMP501'].includes(reportType)) return 'ZA';
    if (reportType.endsWith('_LS')) return 'LS';
    return payGroupCountry;
  }
}
