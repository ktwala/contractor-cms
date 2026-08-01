import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { RequestUser, assertHasLegalEntities, assertLegalEntityAllowed } from './sars-scope';

interface EMP501Summary {
  tax_year: string;
  total_employees: number;
  total_liability: number;
  total_paye: number;
  total_uif: number;
  total_sdl: number;
  irp5_count: number;
  emp201_count: number;
}

interface ReconciliationDiscrepancy {
  category: string;
  irp5_total: number;
  emp201_total: number;
  difference: number;
  percentage_diff: number;
}

export interface EMP501Reconciliation {
  id: string;
  tax_period_id: string;
  tax_year: string;
  status: string;
  summary: EMP501Summary;
  discrepancies: ReconciliationDiscrepancy[];
  reconciled_by?: string;
  reconciled_at?: Date;
  notes?: string;
}

@Injectable()
export class EMP501ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generate EMP501 reconciliation for a tax year (requires legal_entity_id in dto)
   */
  async generateReconciliation(
    taxPeriodId: string,
    dto: { legal_entity_id?: string },
    user: RequestUser,
  ): Promise<EMP501Reconciliation> {
    const legalEntityId = dto?.legal_entity_id;
    if (!legalEntityId) {
      throw new Error('legal_entity_id is required in request body');
    }
    assertLegalEntityAllowed(user, legalEntityId);
    // Get tax period
    const taxPeriod = await (this.prisma as any).taxPeriod.findFirst({
      where: { id: taxPeriodId, periodType: 'annual' },
    });

    if (!taxPeriod) {
      throw new Error('Annual tax period not found');
    }

    const taxYear = taxPeriod.taxYear;

    // Get IRP5 summary (scoped to legal entity)
    const irp5Summary = await this.getIRP5Summary(taxPeriodId, legalEntityId);

    // Get EMP201 summary (scoped to legal entity)
    const emp201Summary = await this.getEMP201Summary(taxYear, legalEntityId);

    // Calculate discrepancies
    const discrepancies = this.calculateDiscrepancies(irp5Summary, emp201Summary);

    // Create summary
    const summary: EMP501Summary = {
      tax_year: taxYear,
      total_employees: irp5Summary.employee_count,
      total_liability: emp201Summary.total_liability,
      total_paye: emp201Summary.total_paye,
      total_uif: emp201Summary.total_uif,
      total_sdl: emp201Summary.total_sdl,
      irp5_count: irp5Summary.certificate_count,
      emp201_count: emp201Summary.return_count,
    };

    // Check if reconciliation already exists for this period + legal entity
    const existing = await (this.prisma as any).eMP501Reconciliation.findFirst({
      where: { taxPeriodId, legalEntityId },
    });

    let reconciliationId: string;

    if (existing) {
      // Update existing
      reconciliationId = existing.id;
      await this.updateReconciliation(reconciliationId, summary, discrepancies, user);
    } else {
      // Create new
      reconciliationId = await this.createReconciliation(
        taxPeriodId,
        legalEntityId,
        taxYear,
        summary,
        discrepancies,
        user,
      );
    }

    return {
      id: reconciliationId,
      tax_period_id: taxPeriodId,
      tax_year: taxYear,
      status: discrepancies.length === 0 ? 'reconciled' : 'discrepancies_found',
      summary,
      discrepancies,
    };
  }

  /**
   * Get IRP5 summary for tax year (scoped via IRP5Certificate.legalEntityId)
   */
  private async getIRP5Summary(taxPeriodId: string, legalEntityId: string) {
    const certificates = await (this.prisma as any).iRP5Certificate.findMany({
      where: {
        taxPeriodId,
        status: { not: 'cancelled' },
        legalEntityId,
      },
    });

    const uniqueEmployees = new Set(certificates.map((c: any) => c.employeeId));

    return {
      employee_count: uniqueEmployees.size,
      certificate_count: certificates.length,
      total_remuneration: certificates.reduce((sum: number, c: any) => sum + Number(c.totalRemuneration || 0), 0),
      total_paye: certificates.reduce((sum: number, c: any) => sum + Number(c.payeDeducted || 0), 0),
      total_uif: certificates.reduce((sum: number, c: any) => sum + Number(c.uifDeducted || 0), 0),
      total_tax: certificates.reduce((sum: number, c: any) => sum + Number(c.totalTax || 0), 0),
    };
  }

  /**
   * Get EMP201 summary for tax year (scoped to legal entity)
   */
  private async getEMP201Summary(taxYear: string, legalEntityId: string) {
    const returns = await (this.prisma as any).eMP201Return.findMany({
      where: {
        taxYear,
        legalEntityId,
        status: { not: 'cancelled' },
      },
    });

    return {
      return_count: returns.length,
      total_employees: returns.reduce((sum: number, r: any) => sum + (r.totalEmployees || 0), 0),
      total_paye: returns.reduce((sum: number, r: any) => sum + Number(r.payeTotal || 0), 0),
      total_uif: returns.reduce((sum: number, r: any) => sum + Number(r.uifTotal || 0), 0),
      total_sdl: returns.reduce((sum: number, r: any) => sum + Number(r.sdlTotal || 0), 0),
      total_liability: returns.reduce((sum: number, r: any) => sum + Number(r.totalLiability || 0), 0),
    };
  }

  /**
   * Calculate discrepancies between IRP5 and EMP201
   */
  private calculateDiscrepancies(irp5Summary: any, emp201Summary: any): ReconciliationDiscrepancy[] {
    const discrepancies: ReconciliationDiscrepancy[] = [];

    // PAYE discrepancy
    const payeDiff = (irp5Summary.total_paye || 0) - (emp201Summary.total_paye || 0);
    if (Math.abs(payeDiff) > 0.01) {
      discrepancies.push({
        category: 'PAYE',
        irp5_total: irp5Summary.total_paye || 0,
        emp201_total: emp201Summary.total_paye || 0,
        difference: payeDiff,
        percentage_diff: emp201Summary.total_paye > 0
          ? (payeDiff / emp201Summary.total_paye) * 100
          : 0,
      });
    }

    // UIF discrepancy
    const uifDiff = (irp5Summary.total_uif || 0) - (emp201Summary.total_uif || 0);
    if (Math.abs(uifDiff) > 0.01) {
      discrepancies.push({
        category: 'UIF',
        irp5_total: irp5Summary.total_uif || 0,
        emp201_total: emp201Summary.total_uif || 0,
        difference: uifDiff,
        percentage_diff: emp201Summary.total_uif > 0
          ? (uifDiff / emp201Summary.total_uif) * 100
          : 0,
      });
    }

    return discrepancies;
  }

  /**
   * Create new reconciliation record
   */
  private async createReconciliation(
    taxPeriodId: string,
    legalEntityId: string,
    taxYear: string,
    summary: EMP501Summary,
    discrepancies: ReconciliationDiscrepancy[],
    user: RequestUser,
  ): Promise<string> {
    const status = discrepancies.length === 0 ? 'reconciled' : 'discrepancies_found';

    const record = await (this.prisma as any).eMP501Reconciliation.create({
      data: {
        taxPeriodId,
        legalEntityId,
        taxYear,
        status,
        totalEmployees: summary.total_employees,
        totalLiability: summary.total_liability,
        totalPaye: summary.total_paye,
        totalUif: summary.total_uif,
        totalSdl: summary.total_sdl,
        irp5Count: summary.irp5_count,
        emp201Count: summary.emp201_count,
        discrepancies: discrepancies as any,
        generatedByUserId: user.sub,
        generatedAt: new Date(),
      },
    });

    return record.id;
  }

  /**
   * Update existing reconciliation
   */
  private async updateReconciliation(
    reconciliationId: string,
    summary: EMP501Summary,
    discrepancies: ReconciliationDiscrepancy[],
    user: RequestUser,
  ) {
    const status = discrepancies.length === 0 ? 'reconciled' : 'discrepancies_found';

    await (this.prisma as any).eMP501Reconciliation.update({
      where: { id: reconciliationId },
      data: {
        status,
        totalEmployees: summary.total_employees,
        totalLiability: summary.total_liability,
        totalPaye: summary.total_paye,
        totalUif: summary.total_uif,
        totalSdl: summary.total_sdl,
        irp5Count: summary.irp5_count,
        emp201Count: summary.emp201_count,
        discrepancies: discrepancies as any,
        generatedByUserId: user.sub,
        generatedAt: new Date(),
      },
    });
  }

  /**
   * Get reconciliation by ID (scoped to user's legal entities)
   */
  async getReconciliation(
    reconciliationId: string,
    user: RequestUser,
  ): Promise<EMP501Reconciliation | null> {
    const record = await (this.prisma as any).eMP501Reconciliation.findUnique({
      where: { id: reconciliationId },
    });

    if (!record) {
      return null;
    }

    assertLegalEntityAllowed(user, record.legalEntityId);

    return {
      id: record.id,
      tax_period_id: record.taxPeriodId,
      tax_year: record.taxYear,
      status: record.status,
      summary: {
        tax_year: record.taxYear,
        total_employees: record.totalEmployees,
        total_liability: Number(record.totalLiability),
        total_paye: Number(record.totalPaye),
        total_uif: Number(record.totalUif),
        total_sdl: Number(record.totalSdl),
        irp5_count: record.irp5Count,
        emp201_count: record.emp201Count,
      },
      discrepancies: (record.discrepancies as ReconciliationDiscrepancy[]) || [],
      reconciled_by: record.reconciledBy || undefined,
      reconciled_at: record.reconciledAt || undefined,
      notes: record.notes || undefined,
    };
  }

  /**
   * Mark reconciliation as reviewed/approved (scoped to user's legal entities)
   * SARS-SOD-02: Submitter cannot approve EMP501
   */
  async approveReconciliation(
    reconciliationId: string,
    approvedBy: string,
    notes: string | undefined,
    user: RequestUser,
  ) {
    const record = await (this.prisma as any).eMP501Reconciliation.findUnique({
      where: { id: reconciliationId },
      select: { legalEntityId: true, submittedByUserId: true },
    });
    if (!record) throw new Error('Reconciliation not found');
    assertLegalEntityAllowed(user, record.legalEntityId);

    // SARS-SOD-02: Submitter cannot approve EMP501
    if (record.submittedByUserId && user.sub && record.submittedByUserId === user.sub) {
      await this.auditService.logSodDenied({
        userId: user.sub,
        ruleId: 'SARS-SOD-02',
        entityType: 'EMP501',
        entityId: reconciliationId,
        legalEntityId: record.legalEntityId,
      });
      throw new ForbiddenException({
        code: 'SOD_VIOLATION',
        message: 'Submitter cannot approve the same EMP501 reconciliation (SARS-SOD-02)',
      });
    }

    await (this.prisma as any).eMP501Reconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: 'approved',
        approvedByUserId: user.sub,
        approvedAt: new Date(),
        reconciledBy: approvedBy,
        reconciledAt: new Date(),
        notes,
      },
    });

    // Audit: state transition (approve)
    await this.auditService.log({
      userId: user.sub,
      action: 'EMP501_APPROVED',
      entityType: 'EMP501Reconciliation',
      entityId: reconciliationId,
      newValue: { status: 'approved' },
    });
  }

  /**
   * Get all reconciliations with filters
   */
  async getReconciliations(filters?: { tax_year?: string; status?: string }) {
    return (this.prisma as any).eMP501Reconciliation.findMany({
      where: {
        ...(filters?.tax_year && { taxYear: filters.tax_year }),
        ...(filters?.status && { status: filters.status }),
      },
      orderBy: { taxYear: 'desc' },
    });
  }

  /**
   * Generate EMP501 CSV export (scoped via getReconciliation)
   */
  async generateEMP501CSV(reconciliationId: string, user: RequestUser): Promise<string> {
    const reconciliation = await this.getReconciliation(reconciliationId, user);

    if (!reconciliation) {
      throw new Error('Reconciliation not found');
    }

    const lines: string[] = [];

    // Header
    lines.push('EMP501 - Employer Annual Reconciliation Declaration');
    lines.push('');
    lines.push(`Tax Year,${reconciliation.tax_year}`);
    lines.push(`Status,${reconciliation.status}`);
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('Description,Count/Amount');
    lines.push(`Total Employees,${reconciliation.summary.total_employees}`);
    lines.push(`IRP5 Certificates Issued,${reconciliation.summary.irp5_count}`);
    lines.push(`EMP201 Returns Submitted,${reconciliation.summary.emp201_count}`);
    lines.push('');
    lines.push(`Total PAYE,${reconciliation.summary.total_paye.toFixed(2)}`);
    lines.push(`Total UIF,${reconciliation.summary.total_uif.toFixed(2)}`);
    lines.push(`Total SDL,${reconciliation.summary.total_sdl.toFixed(2)}`);
    lines.push(`Total Liability,${reconciliation.summary.total_liability.toFixed(2)}`);
    lines.push('');

    // Discrepancies
    if (reconciliation.discrepancies.length > 0) {
      lines.push('DISCREPANCIES');
      lines.push('Category,IRP5 Total,EMP201 Total,Difference,Percentage Diff');

      reconciliation.discrepancies.forEach(disc => {
        lines.push([
          disc.category,
          disc.irp5_total.toFixed(2),
          disc.emp201_total.toFixed(2),
          disc.difference.toFixed(2),
          `${disc.percentage_diff.toFixed(2)}%`,
        ].join(','));
      });
      lines.push('');
    }

    // Footer
    if (reconciliation.reconciled_by) {
      lines.push(`Approved By: ${reconciliation.reconciled_by}`);
      lines.push(`Approved At: ${reconciliation.reconciled_at}`);
    }

    if (reconciliation.notes) {
      lines.push(`Notes: ${reconciliation.notes}`);
    }

    lines.push('');
    lines.push('END OF RECONCILIATION');

    return lines.join('\n');
  }
}
