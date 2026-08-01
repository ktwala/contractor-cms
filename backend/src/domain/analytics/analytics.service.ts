import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import {
  DashboardAnalyticsDto,
  FinancialSummaryDto,
  ContractorSummaryDto,
  ProjectSummaryDto,
  TimesheetSummaryDto,
  TaxSummaryDto,
} from './dto/analytics-response.dto';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  excludeComparisonAnchorContractorsWhere,
  excludeComparisonAnchorSuppliersWhere,
} from '../demo/connector-demo-comparison.constants';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardAnalytics(
    accessContext: AccessContext,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DashboardAnalyticsDto> {
    const [financial, contractors, projects, timesheets, tax] = await Promise.all([
      this.getFinancialSummary(accessContext, startDate, endDate),
      this.getContractorSummary(accessContext),
      this.getProjectSummary(accessContext),
      this.getTimesheetSummary(accessContext, startDate, endDate),
      this.getTaxSummary(accessContext, startDate, endDate),
    ]);

    return {
      financial,
      contractors,
      projects,
      timesheets,
      tax,
    };
  }

  async getFinancialSummary(
    accessContext: AccessContext,
    startDate?: Date,
    endDate?: Date,
  ): Promise<FinancialSummaryDto> {
    const where: any = accessContext.isGlobalAccess ? {} : {
      organizationId: accessContext.targetOrganizationId as string,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      select: {
        totalAmount: true,
        status: true,
      },
    });

    const totalInvoiced = invoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    const totalPaid = invoices
      .filter((inv) => inv.status === 'PAID')
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

    const totalPending = invoices
      .filter((inv) => inv.status === 'SUBMITTED' || inv.status === 'APPROVED')
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

    const invoiceCount = invoices.length;
    const averageInvoiceAmount = invoiceCount > 0 ? totalInvoiced / invoiceCount : 0;

    return {
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalPending: Math.round(totalPending * 100) / 100,
      invoiceCount,
      averageInvoiceAmount: Math.round(averageInvoiceAmount * 100) / 100,
    };
  }

  async getContractorSummary(
    accessContext: AccessContext,
  ): Promise<ContractorSummaryDto> {
    const orgFilter = accessContext.isGlobalAccess ? {} : {
      organizationId: accessContext.targetOrganizationId as string,
    };

    const contractorWhere = accessContext.isGlobalAccess
      ? excludeComparisonAnchorContractorsWhere()
      : {
          supplier: {
            ...orgFilter,
            ...excludeComparisonAnchorSuppliersWhere(),
          },
          ...excludeComparisonAnchorContractorsWhere(),
        };

    const contractors = await this.prisma.contractor.findMany({
      where: contractorWhere,
      select: {
        id: true,
        isActive: true,
      },
    });

    const totalContractors = contractors.length;
    const activeContractors = contractors.filter(
      (c) => c.isActive,
    ).length;
    const inactiveContractors = contractors.filter(
      (c) => !c.isActive,
    ).length;

    // Get active engagements
    const activeEngagements = await this.prisma.contractorEngagement.count({
      where: {
        ...(accessContext.isGlobalAccess
          ? {
              contractor: excludeComparisonAnchorContractorsWhere(),
            }
          : {
              contractor: {
                ...excludeComparisonAnchorContractorsWhere(),
                supplier: {
                  ...orgFilter,
                  ...excludeComparisonAnchorSuppliersWhere(),
                },
              },
            }),
        isActive: true,
      },
    });

    const supplierCount = await this.prisma.supplier.count({
      where: {
        ...orgFilter,
        ...excludeComparisonAnchorSuppliersWhere(),
      },
    });

    return {
      totalContractors,
      activeContractors,
      inactiveContractors,
      activeEngagements,
      supplierCount,
    };
  }

  async getProjectSummary(accessContext: AccessContext): Promise<ProjectSummaryDto> {
    const orgFilter = accessContext.isGlobalAccess ? {} : {
      organizationId: accessContext.targetOrganizationId as string,
    };

    const projects = await this.prisma.project.findMany({
      where: orgFilter,
      select: {
        id: true,
        status: true,
        budget: true,
      },
    });

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
    const completedProjects = projects.filter(
      (p) => p.status === 'COMPLETED',
    ).length;

    const totalBudget = projects.reduce(
      (sum, p) => sum + (p.budget ? Number(p.budget) : 0),
      0,
    );

    // Get total utilized from invoices linked to project timesheets
    const invoices = await this.prisma.invoice.findMany({
      where: accessContext.isGlobalAccess ? {} : {
        timesheets: {
          some: {
            project: {
              organizationId: accessContext.targetOrganizationId as string as string,
            },
          },
        },
      },
      select: {
        totalAmount: true,
      },
    });

    const totalUtilized = invoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    const averageUtilization =
      totalBudget > 0 ? (totalUtilized / totalBudget) * 100 : 0;

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalUtilized: Math.round(totalUtilized * 100) / 100,
      averageUtilization: Math.round(averageUtilization * 100) / 100,
    };
  }

  async getTimesheetSummary(
    accessContext: AccessContext,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TimesheetSummaryDto> {
    // Timesheets are linked to contractors, but wait, Timesheet model has organizationId? No, it doesn't.
    // Let's use contractor.supplier.organizationId
    const where: any = accessContext.isGlobalAccess ? {} : {
      contractor: {
        supplier: {
          organizationId: accessContext.targetOrganizationId as string,
        },
      },
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const timesheets = await this.prisma.timesheet.findMany({
      where,
      select: {
        status: true,
        totalHours: true,
      },
    });

    const totalTimesheets = timesheets.length;
    const pendingApproval = timesheets.filter(
      (t) => t.status === 'SUBMITTED',
    ).length;
    const approved = timesheets.filter((t) => t.status === 'APPROVED').length;
    const rejected = timesheets.filter((t) => t.status === 'REJECTED').length;

    const totalHours = timesheets.reduce(
      (sum, t) => sum + Number(t.totalHours),
      0,
    );

    return {
      totalTimesheets,
      pendingApproval,
      approved,
      rejected,
      totalHours: Math.round(totalHours * 100) / 100,
    };
  }

  async getTaxSummary(
    accessContext: AccessContext,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TaxSummaryDto> {
    const where: any = accessContext.isGlobalAccess ? {} : {
      organizationId: accessContext.targetOrganizationId as string,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const instructions = await this.prisma.withholdingInstruction.findMany({
      where,
      select: {
        withholdingType: true,
        withholdingAmount: true,
      },
    });

    const totalWithheld = instructions.reduce(
      (sum, inst) => sum + Number(inst.withholdingAmount),
      0,
    );

    const payeWithheld = instructions
      .filter((inst) => inst.withholdingType === 'PAYE')
      .reduce((sum, inst) => sum + Number(inst.withholdingAmount), 0);

    const sdlWithheld = instructions
      .filter((inst) => inst.withholdingType === 'SDL')
      .reduce((sum, inst) => sum + Number(inst.withholdingAmount), 0);

    const uifWithheld = instructions
      .filter((inst) => inst.withholdingType === 'UIF')
      .reduce((sum, inst) => sum + Number(inst.withholdingAmount), 0);

    const instructionCount = instructions.length;

    return {
      totalWithheld: Math.round(totalWithheld * 100) / 100,
      payeWithheld: Math.round(payeWithheld * 100) / 100,
      sdlWithheld: Math.round(sdlWithheld * 100) / 100,
      uifWithheld: Math.round(uifWithheld * 100) / 100,
      instructionCount,
    };
  }
}
