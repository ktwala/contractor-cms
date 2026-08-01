import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { RequestUser, assertHasLegalEntities, assertLegalEntityAllowed } from './sars-scope';

@Injectable()
export class SarsTaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ==================== IRP5 GENERATION ====================

  /**
   * Generate IRP5 certificates for all employees for a tax year (scoped to user's legal entities)
   */
  async generateIRP5Certificates(taxPeriodId: string, user: RequestUser) {
    const allowed = assertHasLegalEntities(user);

    // Get tax period details
    const taxPeriod = await (this.prisma as any).taxPeriod.findUnique({
      where: { id: taxPeriodId },
    });

    if (!taxPeriod) {
      throw new Error('Tax period not found');
    }

    // Get employees who worked during this tax year, scoped to user's legal entities (via PayRun -> PayGroup)
    const employeeResults = await this.prisma.employeeResult.findMany({
      where: {
        payrun: {
          status: 'APPROVED',
          payGroup: {
            legalEntityId: { in: allowed },
          },
        },
      },
      select: {
        employeeId: true,
      },
      distinct: ['employeeId'],
    });

    const certificates = [];

    for (const result of employeeResults) {
      const certificate = await this.generateIRP5ForEmployee(
        taxPeriodId,
        result.employeeId,
        user,
        taxPeriod
      );
      certificates.push(certificate);
    }

    return certificates;
  }

  /**
   * Generate IRP5 certificate for a specific employee (scoped to user's legal entities)
   */
  async generateIRP5ForEmployee(taxPeriodId: string, employeeId: string, user: RequestUser, taxPeriod?: any) {
    const allowed = assertHasLegalEntities(user);

    // Get tax period if not provided
    if (!taxPeriod) {
      taxPeriod = await (this.prisma as any).taxPeriod.findUnique({
        where: { id: taxPeriodId },
      });
    }

    // Get employee details with employments (for scope check and legalEntityId derivation)
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { employments: { select: { legalEntityId: true, effectiveFrom: true, effectiveTo: true } } },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    // Scope: employee must have employment in an allowed legal entity (or employee.legalEntityId)
    const employeeLegalEntityIds = [
      ...(employee.legalEntityId ? [employee.legalEntityId] : []),
      ...(employee.employments?.map((e: { legalEntityId: string }) => e.legalEntityId) || []),
    ];
    const hasAccess = employeeLegalEntityIds.some((id) => allowed.includes(id));
    if (!hasAccess) {
      throw new Error('No access to this employee legal entity');
    }

    // Get all payrun data for this employee during the tax year (include payrun.payGroup for deterministic legalEntityId)
    const employeeResults = await this.prisma.employeeResult.findMany({
      where: {
        employeeId,
        payrun: {
          status: 'APPROVED',
        },
      },
      include: {
        payLines: true,
        payrun: { include: { payGroup: true } },
      },
    });

    // Calculate totals
    const totals = this.calculateIRP5Totals(employeeResults);

    // Derive legalEntityId deterministically: use pay group from payrun that paid most recently (periodEnd desc)
    const legalEntityId = this.deriveLegalEntityIdForIRP5(employeeResults, taxPeriod, employee);

    // Get medical aid details
    const medicalAidEnrollment = await this.prisma.employeeBenefit.findFirst({
      where: {
        employeeId,
        status: 'active',
      },
      include: {
        plan: true,
      },
    });


    // Generate certificate number
    const certificateNumber = `IRP5-${taxPeriod.taxYear}-${employee.employeeNo}`;

    // Check if certificate already exists
    const existing = await (this.prisma as any).iRP5Certificate.findFirst({
      where: { taxPeriodId, employeeId },
    });

    let certificateId: string;

    if (existing) {
      // Update existing certificate
      certificateId = existing.id;
      await this.updateIRP5Certificate(certificateId, employee, totals, medicalAidEnrollment, certificateNumber, legalEntityId);
    } else {
      // Create new certificate
      certificateId = await this.createIRP5Certificate(
        taxPeriodId,
        employee,
        totals,
        medicalAidEnrollment,
        certificateNumber,
        legalEntityId
      );
    }

    // Return the certificate
    return (this.prisma as any).iRP5Certificate.findUnique({
      where: { id: certificateId },
    });
  }

  /**
   * Derive legalEntityId deterministically for IRP5.
   * Uses pay group from the payrun that paid the employee most recently (periodEnd desc).
   * Fallback: employment active during tax period, then employee.legalEntityId.
   */
  private deriveLegalEntityIdForIRP5(employeeResults: any[], taxPeriod: any, employee: any): string {
    if (employeeResults.length > 0) {
      const sorted = [...employeeResults].sort((a, b) => {
        const aEnd = a.payrun?.periodEnd ? new Date(a.payrun.periodEnd).getTime() : 0;
        const bEnd = b.payrun?.periodEnd ? new Date(b.payrun.periodEnd).getTime() : 0;
        return bEnd - aEnd;
      });
      const leId = sorted[0]?.payrun?.payGroup?.legalEntityId;
      if (leId) return leId;
    }
    if (employee.legalEntityId) return employee.legalEntityId;
    const periodEnd = taxPeriod?.periodEnd ? new Date(taxPeriod.periodEnd) : new Date();
    const periodStart = taxPeriod?.periodStart ? new Date(taxPeriod.periodStart) : new Date();
    const activeEmployment = (employee.employments || []).find((e: any) => {
      const from = e.effectiveFrom ? new Date(e.effectiveFrom) : new Date(0);
      const to = e.effectiveTo ? new Date(e.effectiveTo) : new Date(9999, 11, 31);
      return from <= periodEnd && to >= periodStart;
    });
    if (activeEmployment?.legalEntityId) return activeEmployment.legalEntityId;
    if (employee.employments?.[0]?.legalEntityId) return employee.employments[0].legalEntityId;
    throw new Error('Cannot determine legalEntityId for IRP5 certificate');
  }

  /**
   * Calculate IRP5 totals from payrun and tax data
   */
  private calculateIRP5Totals(employeeResults: any[]) {
    const totals = {
      income_from_employment: 0,
      annual_bonus: 0,
      commission: 0,
      overtime: 0,
      travel_allowance: 0,
      subsistence_allowance: 0,
      other_allowances: 0,
      company_car_fringe_benefit: 0,
      residential_accommodation: 0,
      low_interest_loans: 0,
      other_fringe_benefits: 0,
      severance_pay: 0,
      leave_payout: 0,
      pension_fund_contributions: 0,
      retirement_annuity_contributions: 0,
      medical_aid_contributions: 0,
      paye_deducted: 0,
      uif_deducted: 0,
      sdl_deducted: 0,
      pension_fund_employer: 0,
      retirement_annuity_employer: 0,
      medical_aid_employer: 0,
      uif_employer: 0,
      total_remuneration: 0,
      taxable_income: 0,
      total_tax: 0,
    };

    // Sum up from all payrun results
    employeeResults.forEach(result => {
      totals.total_remuneration += Number(result.gross || 0);
      totals.taxable_income += Number(result.taxableIncome || 0);
      totals.paye_deducted += Number(result.paye || 0);
      totals.total_tax += Number(result.paye || 0);

      // Process pay lines
      result.payLines?.forEach((line: any) => {
        if (line.type === 'EARNING') {
          totals.income_from_employment += Number(line.amount || 0);
        }
      });
    });

    return totals;
  }

  /**
   * Create new IRP5 certificate
   */
  private async createIRP5Certificate(
    taxPeriodId: string,
    employee: any,
    totals: any,
    medicalAid: any,
    certificateNumber: string,
    legalEntityId: string
  ): Promise<string> {
    const certificate = await (this.prisma as any).iRP5Certificate.create({
      data: {
        taxPeriodId,
        employeeId: employee.id,
        legalEntityId,
        employeeNumber: employee.employeeNo,
        idNumber: employee.idNumber,
        initials: employee.firstName?.charAt(0),
        surname: employee.lastName,
        firstNames: employee.firstName,
        dateOfBirth: employee.dateOfBirth,
        natureOfPerson: '1', // Default to employee
        incomeFromEmployment: totals.income_from_employment,
        overtime: totals.overtime,
        travelAllowance: totals.travel_allowance,
        otherAllowances: totals.other_allowances,
        payeDeducted: totals.paye_deducted,
        uifDeducted: totals.uif_deducted,
        sdlDeducted: totals.sdl_deducted,
        pensionFundContributions: totals.pension_fund_contributions,
        medicalAidContributions: totals.medical_aid_contributions,
        uifEmployer: totals.uif_employer,
        pensionFundEmployer: totals.pension_fund_employer,
        medicalAidEmployer: totals.medical_aid_employer,
        medicalAidName: medicalAid?.plan?.name,
        medicalAidNumber: medicalAid?.memberNumber,
        totalRemuneration: totals.total_remuneration,
        taxableIncome: totals.taxable_income,
        totalTax: totals.total_tax,
        certificateNumber,
        issueDate: new Date(),
        status: 'generated',
        generatedAt: new Date(),
      },
    });

    return certificate.id;
  }

  /**
   * Update existing IRP5 certificate
   */
  private async updateIRP5Certificate(
    certificateId: string,
    employee: any,
    totals: any,
    medicalAid: any,
    certificateNumber: string,
    legalEntityId: string
  ) {
    await (this.prisma as any).iRP5Certificate.update({
      where: { id: certificateId },
      data: {
        legalEntityId,
        incomeFromEmployment: totals.income_from_employment,
        overtime: totals.overtime,
        travelAllowance: totals.travel_allowance,
        otherAllowances: totals.other_allowances,
        payeDeducted: totals.paye_deducted,
        uifDeducted: totals.uif_deducted,
        sdlDeducted: totals.sdl_deducted,
        pensionFundContributions: totals.pension_fund_contributions,
        medicalAidContributions: totals.medical_aid_contributions,
        uifEmployer: totals.uif_employer,
        pensionFundEmployer: totals.pension_fund_employer,
        medicalAidEmployer: totals.medical_aid_employer,
        medicalAidName: medicalAid?.plan?.name,
        medicalAidNumber: medicalAid?.memberNumber,
        totalRemuneration: totals.total_remuneration,
        taxableIncome: totals.taxable_income,
        totalTax: totals.total_tax,
        certificateNumber,
        issueDate: new Date(),
        status: 'generated',
        generatedAt: new Date(),
      },
    });
  }

  /**
   * Get IRP5 certificates for a tax period (scoped via IRP5Certificate.legalEntityId)
   */
  async getIRP5Certificates(
    taxPeriodId: string,
    filters?: { status?: string; employee_id?: string },
    user?: RequestUser,
  ) {
    const allowed = user ? assertHasLegalEntities(user) : [];

    return (this.prisma as any).iRP5Certificate.findMany({
      where: {
        taxPeriodId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.employee_id && { employeeId: filters.employee_id }),
        ...(allowed.length > 0 && { legalEntityId: { in: allowed } }),
      },
      include: {
        taxPeriod: true,
      },
      orderBy: { surname: 'asc' },
    });
  }

  // ==================== EMP201 GENERATION ====================

  /**
   * Generate EMP201 return for a specific month (requires legal_entity_id in dto)
   */
  async generateEMP201Return(
    taxPeriodId: string,
    dto: { legal_entity_id?: string },
    user: RequestUser,
    employerDetails?: any,
  ) {
    const legalEntityId = dto?.legal_entity_id;
    if (!legalEntityId) {
      throw new Error('legal_entity_id is required in request body');
    }
    assertLegalEntityAllowed(user, legalEntityId);
    // Get tax period
    const taxPeriod = await (this.prisma as any).taxPeriod.findFirst({
      where: { id: taxPeriodId, periodType: 'monthly' },
    });

    if (!taxPeriod) {
      throw new Error('Monthly tax period not found');
    }

    // Calculate totals from payruns in this month, scoped to legal entity
    const totals = await this.calculateEMP201Totals(
      taxPeriod.periodStart,
      taxPeriod.periodEnd,
      legalEntityId
    );

    // Get employer details
    if (!employerDetails) {
      employerDetails = await this.getEmployerDetails();
    }

    // Calculate total liability
    const totalLiability = totals.paye_total + totals.sdl_total + totals.uif_total - totals.eti_total;

    // Check if EMP201 already exists for this period + legal entity
    const existing = await (this.prisma as any).eMP201Return.findFirst({
      where: { taxPeriodId, legalEntityId },
    });

    let returnId: string;

    if (existing) {
      // Update existing return
      returnId = existing.id;
      await this.updateEMP201Return(returnId, totals, taxPeriod, employerDetails, totalLiability, user);
    } else {
      // Create new return
      returnId = await this.createEMP201Return(
        taxPeriodId,
        legalEntityId,
        totals,
        taxPeriod,
        employerDetails,
        totalLiability,
        user,
      );
    }

    // Return the EMP201
    return (this.prisma as any).eMP201Return.findUnique({
      where: { id: returnId },
    });
  }

  /**
   * Calculate EMP201 totals for a month (scoped to legal entity via PayRun -> PayGroup)
   */
  private async calculateEMP201Totals(periodStart: Date, periodEnd: Date, legalEntityId: string) {
    // Get employee counts and totals from employee results, scoped to legal entity
    const results = await this.prisma.employeeResult.findMany({
      where: {
        payrun: {
          status: 'APPROVED',
          payGroup: {
            legalEntityId,
          },
        },
      },
      include: {
        employee: true,
      },
    });

    const totals = {
      total_employees: new Set(results.map(r => r.employeeId)).size,
      local_employees: 0,
      foreign_employees: 0,
      paye_current_month: 0,
      paye_adjustments: 0,
      paye_total: 0,
      sdl_current_month: 0,
      sdl_adjustments: 0,
      sdl_total: 0,
      uif_employee_current: 0,
      uif_employer_current: 0,
      uif_adjustments: 0,
      uif_total: 0,
      eti_current_month: 0,
      eti_adjustments: 0,
      eti_total: 0,
    };

    // Sum up totals from results
    results.forEach(result => {
      totals.paye_total += Number(result.paye || 0);
    });

    totals.paye_current_month = totals.paye_total;
    totals.local_employees = totals.total_employees;

    return totals;
  }

  /**
   * Create new EMP201 return
   */
  private async createEMP201Return(
    taxPeriodId: string,
    legalEntityId: string,
    totals: any,
    taxPeriod: any,
    employerDetails: any,
    totalLiability: number,
    user: RequestUser,
  ): Promise<string> {
    const emp201 = await (this.prisma as any).eMP201Return.create({
      data: {
        taxPeriodId,
        legalEntityId,
        employerPayeNumber: employerDetails.paye_number,
        employerName: employerDetails.company_name,
        employerTradingName: employerDetails.trading_name,
        taxYear: taxPeriod.taxYear,
        monthNumber: taxPeriod.monthNumber || 1,
        periodStart: taxPeriod.periodStart,
        periodEnd: taxPeriod.periodEnd,
        submissionDueDate: taxPeriod.submissionDueDate,
        totalEmployees: totals.total_employees,
        localEmployees: totals.local_employees,
        foreignEmployees: totals.foreign_employees,
        payeCurrentMonth: totals.paye_current_month,
        payeAdjustments: totals.paye_adjustments,
        payeTotal: totals.paye_total,
        sdlCurrentMonth: totals.sdl_current_month,
        sdlAdjustments: totals.sdl_adjustments,
        sdlTotal: totals.sdl_total,
        uifEmployeeCurrent: totals.uif_employee_current,
        uifEmployerCurrent: totals.uif_employer_current,
        uifAdjustments: totals.uif_adjustments,
        uifTotal: totals.uif_total,
        etiCurrentMonth: totals.eti_current_month,
        etiAdjustments: totals.eti_adjustments,
        etiTotal: totals.eti_total,
        totalLiability,
        status: 'draft',
        generatedByUserId: user.sub,
        generatedAt: new Date(),
        country: 'ZAF',
      },
    });

    return emp201.id;
  }

  /**
   * Update existing EMP201 return
   */
  private async updateEMP201Return(
    returnId: string,
    totals: any,
    taxPeriod: any,
    employerDetails: any,
    totalLiability: number,
    user: RequestUser,
  ) {
    await (this.prisma as any).eMP201Return.update({
      where: { id: returnId },
      data: {
        totalEmployees: totals.total_employees,
        localEmployees: totals.local_employees,
        foreignEmployees: totals.foreign_employees,
        payeCurrentMonth: totals.paye_current_month,
        payeTotal: totals.paye_total,
        sdlCurrentMonth: totals.sdl_current_month,
        sdlTotal: totals.sdl_total,
        uifEmployeeCurrent: totals.uif_employee_current,
        uifEmployerCurrent: totals.uif_employer_current,
        uifTotal: totals.uif_total,
        etiCurrentMonth: totals.eti_current_month,
        etiTotal: totals.eti_total,
        totalLiability,
        generatedByUserId: user.sub,
        generatedAt: new Date(),
      },
    });
  }

  /**
   * Get EMP201 returns with filters (scoped to user's legal entities)
   */
  async getEMP201Returns(
    filters?: { tax_year?: string; month_number?: number; status?: string },
    user?: RequestUser,
  ) {
    const allowed = user ? assertHasLegalEntities(user) : [];

    return (this.prisma as any).eMP201Return.findMany({
      where: {
        ...(filters?.tax_year && { taxYear: filters.tax_year }),
        ...(filters?.month_number && { monthNumber: filters.month_number }),
        ...(filters?.status && { status: filters.status }),
        ...(allowed.length > 0 && { legalEntityId: { in: allowed } }),
      },
      orderBy: [
        { taxYear: 'desc' },
        { monthNumber: 'desc' },
      ],
    });
  }

  /**
   * Mark EMP201 as submitted (scoped: verifies user has access to return's legal entity)
   * SARS-SOD-01: Generator cannot submit EMP201
   */
  async submitEMP201(returnId: string, submittedBy: string, sarsReference: string | undefined, user: RequestUser) {
    const emp201 = await (this.prisma as any).eMP201Return.findUnique({
      where: { id: returnId },
      select: { legalEntityId: true, generatedByUserId: true },
    });
    if (!emp201) throw new Error('EMP201 return not found');
    assertLegalEntityAllowed(user, emp201.legalEntityId);

    // SARS-SOD-01: Generator cannot submit EMP201
    if (emp201.generatedByUserId && user.sub && emp201.generatedByUserId === user.sub) {
      await this.auditService.logSodDenied({
        userId: user.sub,
        ruleId: 'SARS-SOD-01',
        entityType: 'EMP201',
        entityId: returnId,
        legalEntityId: emp201.legalEntityId,
      });
      throw new ForbiddenException({
        code: 'SOD_VIOLATION',
        message: 'Generator cannot submit the same EMP201 return (SARS-SOD-01)',
      });
    }

    await (this.prisma as any).eMP201Return.update({
      where: { id: returnId },
      data: {
        status: 'submitted',
        submittedByUserId: user.sub,
        submittedAt: new Date(),
        submittedBy,
        sarsReferenceNumber: sarsReference,
      },
    });

    // Log submission
    await this.logSARSSubmission('EMP201', returnId, emp201.legalEntityId, submittedBy, 'manual');

    // Audit: state transition (submit)
    await this.auditService.log({
      userId: user.sub,
      action: 'EMP201_SUBMITTED',
      entityType: 'EMP201Return',
      entityId: returnId,
      newValue: { status: 'submitted', sarsReference },
    });
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get employer details
   */
  private async getEmployerDetails() {
    // This would come from a company settings table
    // For now, return mock data
    return {
      paye_number: '7123456789',
      company_name: 'Example Company (Pty) Ltd',
      trading_name: 'Example Company',
    };
  }

  /**
   * Log SARS submission
   */
  private async logSARSSubmission(
    submissionType: string,
    documentId: string,
    legalEntityId: string,
    submittedBy: string,
    method: string,
    status: string = 'pending'
  ) {
    await (this.prisma as any).sarsSubmission.create({
      data: {
        submissionType,
        documentId,
        legalEntityId,
        submittedBy,
        submissionMethod: method,
        status,
      },
    });
  }

  /**
   * Get tax periods (requires user to have at least one legal entity)
   */
  async getTaxPeriods(filters?: { tax_year?: string; period_type?: string }, user?: RequestUser) {
    if (user) assertHasLegalEntities(user);
    return (this.prisma as any).taxPeriod.findMany({
      where: {
        ...(filters?.tax_year && { taxYear: filters.tax_year }),
        ...(filters?.period_type && { periodType: filters.period_type }),
      },
      orderBy: [
        { taxYear: 'desc' },
        { periodStart: 'desc' },
      ],
    });
  }

  /**
   * Get IRP5 certificate by ID (scoped via IRP5Certificate.legalEntityId)
   */
  async getIRP5ById(id: string, user?: RequestUser): Promise<any> {
    const allowed = user ? assertHasLegalEntities(user) : [];

    const cert = await (this.prisma as any).iRP5Certificate.findUnique({
      where: { id },
      include: { taxPeriod: true },
    });

    if (!cert) return null;
    if (allowed.length > 0 && !allowed.includes(cert.legalEntityId)) return null;

    return [cert];
  }

  /**
   * Get EMP201 return by ID (with formatted data, scoped to user's legal entities)
   */
  async getEMP201ById(id: string, user?: RequestUser): Promise<any> {
    const emp201 = await (this.prisma as any).eMP201Return.findUnique({
      where: { id },
    });

    if (!emp201) return null;
    if (user) assertLegalEntityAllowed(user, emp201.legalEntityId);

    // Format to match the CSV service interface
    return {
      id: emp201.id,
      tax_period_id: emp201.taxPeriodId,
      period_month: `${emp201.taxYear}-${String(emp201.monthNumber).padStart(2, '0')}`,
      employer_tax_number: emp201.employerTaxNumber || '0000000000',
      employer_paye_number: emp201.employerPayeNumber,
      employer_name: emp201.employerName,
      // Employee counts
      total_employees: emp201.totalEmployees || 0,
      sa_employees: emp201.localEmployees || 0,
      foreign_employees: emp201.foreignEmployees || 0,
      // PAYE
      total_paye: Number(emp201.payeTotal || 0),
      // UIF
      total_uif: Number(emp201.uifTotal || 0),
      employee_uif: Number(emp201.uifEmployeeCurrent || 0),
      employer_uif: Number(emp201.uifEmployerCurrent || 0),
      // SDL
      total_sdl: Number(emp201.sdlTotal || 0),
      // Totals
      total_liability: Number(emp201.totalLiability || 0),
      previous_balance: 0, // Would come from previous period if needed
      total_due: Number(emp201.totalLiability || 0),
    };
  }
}
