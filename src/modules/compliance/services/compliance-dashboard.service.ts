import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';

export interface ComplianceDashboardData {
  overview: any;
  upcomingDeadlines: any[];
  activeAlerts: any[];
  checklistItems: any[];
  statutoryStatus: any;
  legislativeChanges: any[];
}

@Injectable()
export class ComplianceDashboardService {
  private readonly logger = new Logger(ComplianceDashboardService.name);

  constructor(private readonly prisma: PrismaService) { }

  // Get compliance dashboard data
  async getDashboard(legalEntityId: string): Promise<ComplianceDashboardData> {
    const [overview, upcomingDeadlines, activeAlerts, checklistItems, statutoryStatus, legislativeChanges] = await Promise.all([
      this.getComplianceOverview(legalEntityId),
      this.getUpcomingDeadlines(legalEntityId),
      this.getActiveAlerts(legalEntityId),
      this.getChecklistItems(legalEntityId),
      this.getStatutoryStatus(legalEntityId),
      this.getRecentLegislativeChanges(),
    ]);

    return {
      overview,
      upcomingDeadlines,
      activeAlerts,
      checklistItems,
      statutoryStatus,
      legislativeChanges,
    };
  }

  // Get compliance overview
  async getComplianceOverview(legalEntityId: string): Promise<any> {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().substring(0, 7);

    // Check UIF status
    const uifCurrent = await this.prisma.uIFDeclaration.findFirst({
      where: { legalEntityId, declarationPeriod: lastMonthStr },
    });

    // Check SDL status
    const sdlCurrent = await this.prisma.sDLDeclaration.findFirst({
      where: { legalEntityId, declarationPeriod: lastMonthStr },
    });

    // Check COIDA status
    const currentYear = new Date().getFullYear();
    const coidaCurrent = await this.prisma.cOIDAAssessment.findFirst({
      where: { legalEntityId, assessmentYear: currentYear },
    });

    return {
      uif: {
        status: uifCurrent?.status || 'pending',
        period: lastMonthStr,
        lastSubmitted: uifCurrent?.submittedAt,
      },
      sdl: {
        status: sdlCurrent?.status || 'pending',
        period: lastMonthStr,
        lastSubmitted: sdlCurrent?.submittedAt,
        isExempt: sdlCurrent?.isExempt || false,
      },
      coida: {
        status: coidaCurrent?.status || 'pending',
        year: currentYear,
        lastSubmitted: coidaCurrent?.submittedAt,
        balanceDue: coidaCurrent ? Number(coidaCurrent.balanceDue) : null,
      },
      overallHealth: this.calculateOverallHealth(uifCurrent, sdlCurrent, coidaCurrent),
    };
  }

  private calculateOverallHealth(uif: any, sdl: any, coida: any): string {
    const statuses = [uif?.status, sdl?.status, coida?.status].filter(Boolean);

    if (statuses.length === 0) return 'warning';
    if (statuses.every(s => s === 'submitted' || s === 'paid' || s === 'accepted')) return 'good';
    if (statuses.some(s => s === 'rejected')) return 'critical';
    return 'warning';
  }

  // Get upcoming deadlines
  async getUpcomingDeadlines(legalEntityId: string): Promise<any[]> {
    const deadlines: any[] = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // UIF deadline (7th of following month)
    const uifDeadline = new Date(currentYear, currentMonth + 1, 7);
    deadlines.push({
      type: 'UIF',
      description: 'UIF Declaration Submission',
      dueDate: uifDeadline,
      daysRemaining: Math.ceil((uifDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      severity: 'medium',
    });

    // SDL deadline (7th of following month)
    const sdlDeadline = new Date(currentYear, currentMonth + 1, 7);
    deadlines.push({
      type: 'SDL',
      description: 'Skills Development Levy',
      dueDate: sdlDeadline,
      daysRemaining: Math.ceil((sdlDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      severity: 'medium',
    });

    // COIDA deadline (end of Q1)
    if (currentMonth < 3) {
      const coidaDeadline = new Date(currentYear, 2, 31);
      deadlines.push({
        type: 'COIDA',
        description: 'COIDA Return of Earnings',
        dueDate: coidaDeadline,
        daysRemaining: Math.ceil((coidaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        severity: 'high',
      });
    }

    return deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  // Get active alerts
  async getActiveAlerts(legalEntityId: string): Promise<any[]> {
    // Check for overdue submissions
    const alerts: any[] = [];
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().substring(0, 7);

    const uif = await this.prisma.uIFDeclaration.findFirst({
      where: { legalEntityId, declarationPeriod: lastMonthStr },
    });

    if (!uif || uif.status === 'draft') {
      alerts.push({
        id: `uif-${lastMonthStr}`,
        type: 'overdue',
        severity: 'high',
        title: 'UIF Declaration Overdue',
        message: `UIF declaration for ${lastMonthStr} has not been submitted`,
        createdAt: new Date(),
      });
    }

    const sdl = await this.prisma.sDLDeclaration.findFirst({
      where: { legalEntityId, declarationPeriod: lastMonthStr },
    });

    if (!sdl || sdl.status === 'draft') {
      alerts.push({
        id: `sdl-${lastMonthStr}`,
        type: 'overdue',
        severity: 'high',
        title: 'SDL Declaration Overdue',
        message: `SDL declaration for ${lastMonthStr} has not been submitted`,
        createdAt: new Date(),
      });
    }

    return alerts;
  }

  // Get checklist items
  async getChecklistItems(legalEntityId: string): Promise<any[]> {
    const currentMonth = new Date().toISOString().substring(0, 7);

    return [
      { id: '1', category: 'monthly', description: 'Submit UIF declaration', status: 'pending', dueDate: new Date() },
      { id: '2', category: 'monthly', description: 'Submit SDL declaration', status: 'pending', dueDate: new Date() },
      { id: '3', category: 'monthly', description: 'Review payroll exceptions', status: 'pending', dueDate: new Date() },
      { id: '4', category: 'annual', description: 'Submit COIDA return of earnings', status: 'pending', dueDate: new Date(new Date().getFullYear(), 2, 31) },
    ];
  }

  // Get statutory status
  async getStatutoryStatus(legalEntityId: string): Promise<any> {
    const currentYear = new Date().getFullYear();

    // Get recent declarations
    const uifDeclarations = await this.prisma.uIFDeclaration.findMany({
      where: { legalEntityId },
      orderBy: { declarationPeriod: 'desc' },
      take: 6,
    });

    const sdlDeclarations = await this.prisma.sDLDeclaration.findMany({
      where: { legalEntityId },
      orderBy: { declarationPeriod: 'desc' },
      take: 6,
    });

    const coidaAssessments = await this.prisma.cOIDAAssessment.findMany({
      where: { legalEntityId },
      orderBy: { assessmentYear: 'desc' },
      take: 3,
    });

    return {
      uif: {
        recentSubmissions: uifDeclarations.map(d => ({
          period: d.declarationPeriod,
          status: d.status,
          amount: Number(d.totalUifContribution),
        })),
        ytdTotal: uifDeclarations
          .filter(d => d.declarationPeriod.startsWith(String(currentYear)))
          .reduce((sum, d) => sum + Number(d.totalUifContribution), 0),
      },
      sdl: {
        recentSubmissions: sdlDeclarations.map(d => ({
          period: d.declarationPeriod,
          status: d.status,
          amount: Number(d.sdlLevy),
          isExempt: d.isExempt,
        })),
        ytdTotal: sdlDeclarations
          .filter(d => d.declarationPeriod.startsWith(String(currentYear)))
          .reduce((sum, d) => sum + Number(d.sdlLevy), 0),
      },
      coida: {
        recentAssessments: coidaAssessments.map(a => ({
          year: a.assessmentYear,
          status: a.status,
          assessment: Number(a.totalAssessment),
          paid: Number(a.paidAmount),
          balance: Number(a.balanceDue),
        })),
      },
    };
  }

  // Get recent legislative changes
  async getRecentLegislativeChanges(): Promise<any[]> {
    // Return static list of recent changes (would be dynamic in production)
    return [
      {
        id: '1',
        title: 'UIF Threshold Update',
        description: 'UIF contribution threshold increased to R17,712',
        effectiveDate: new Date('2024-03-01'),
        category: 'UIF',
      },
      {
        id: '2',
        title: 'SDL Exemption Threshold',
        description: 'Small employer exemption threshold remains R500,000 annual payroll',
        effectiveDate: new Date('2024-03-01'),
        category: 'SDL',
      },
    ];
  }

  // Cron: Check upcoming deadlines and create alerts
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkUpcomingDeadlines() {
    this.logger.log('Checking upcoming compliance deadlines...');

    const entities = await this.prisma.legalEntity.findMany();

    for (const entity of entities) {
      const deadlines = await this.getUpcomingDeadlines(entity.id);

      for (const deadline of deadlines) {
        if (deadline.daysRemaining <= 3 && deadline.daysRemaining > 0) {
          this.logger.warn(`${deadline.type} deadline in ${deadline.daysRemaining} days for ${entity.name}`);
        }
      }
    }
  }

  // Cron: Generate monthly checklist
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateMonthlyChecklist() {
    this.logger.log('Generating monthly compliance checklist...');
    // Implementation would create checklist items for the new month
  }

  // Update checklist item status
  async updateChecklistItem(
    itemId: string,
    status: string,
    userId: string,
    notes?: string,
  ): Promise<void> {
    this.logger.log(`Updating checklist item ${itemId} to status ${status}`);
    // In production, would update database
  }

  // Acknowledge alert
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    this.logger.log(`Alert ${alertId} acknowledged by ${userId}`);
    // In production, would update database
  }

  // Dismiss alert
  async dismissAlert(alertId: string): Promise<void> {
    this.logger.log(`Alert ${alertId} dismissed`);
    // In production, would update database
  }
}

