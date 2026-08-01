import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BenefitPlansService } from './benefit-plans.service';
import { Prisma } from '@prisma/client';

export interface CreateEnrollmentDto {
  employeeId: string;
  planId: string;
  optionId?: string;
  enrollmentDate: Date;
  effectiveDate: Date;
  employeeContribution: number;
  employerContribution: number;
  isCustomRate?: boolean;
  customRateReason?: string;
  notes?: string;
  createdBy?: string;
}

@Injectable()
export class BenefitEnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly benefitPlansService: BenefitPlansService,
  ) { }

  async createEnrollment(data: CreateEnrollmentDto): Promise<any> {
    // Validate plan exists
    const planExists = await this.benefitPlansService.validatePlanExists(data.planId);
    if (!planExists) {
      throw new Error('Benefit plan not found');
    }

    // Validate option if provided
    if (data.optionId) {
      const optionExists = await this.benefitPlansService.validateOptionExists(data.optionId);
      if (!optionExists) {
        throw new Error('Benefit plan option not found');
      }
    }

    // Create enrollment with history
    const enrollment = await this.prisma.employeeBenefit.create({
      data: {
        employeeId: data.employeeId,
        planId: data.planId,
        optionId: data.optionId,
        enrollmentDate: data.enrollmentDate,
        effectiveDate: data.effectiveDate,
        status: 'pending',
        employeeContribution: data.employeeContribution,
        employerContribution: data.employerContribution,
        totalContribution: data.employeeContribution + data.employerContribution,
        isCustomRate: data.isCustomRate ?? false,
        customRateReason: data.customRateReason,
        notes: data.notes,
        createdBy: data.createdBy,
        history: {
          create: {
            action: 'created',
            changedBy: data.createdBy,
            details: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
          },
        },
      },
    });

    return enrollment;
  }

  async getEnrollmentById(id: string): Promise<any | null> {
    return this.prisma.employeeBenefit.findUnique({
      where: { id },
      include: {
        plan: true,
        option: true,
        employee: {
          select: { firstName: true, lastName: true, employeeNo: true },
        },
      },
    });
  }

  async getEmployeeEnrollments(employeeId: string, activeOnly: boolean = true): Promise<any[]> {
    const where: any = { employeeId };
    if (activeOnly) {
      where.status = 'active';
    }

    return this.prisma.employeeBenefit.findMany({
      where,
      include: {
        plan: true,
        option: true,
      },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  async getPendingApprovals(): Promise<any[]> {
    return this.prisma.employeeBenefit.findMany({
      where: { status: 'pending_approval' },
      include: {
        plan: true,
        option: true,
        employee: {
          select: { firstName: true, lastName: true, employeeNo: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveEnrollment(enrollmentId: string, approvedBy: string): Promise<any> {
    const enrollment = await this.prisma.employeeBenefit.update({
      where: { id: enrollmentId },
      data: {
        status: 'pending_approval',
        approvedBy,
        approvedAt: new Date(),
        history: {
          create: {
            action: 'approved',
            changedBy: approvedBy,
          },
        },
      },
    });

    return enrollment;
  }

  async verifyDocuments(enrollmentId: string, verifiedBy: string): Promise<void> {
    await this.prisma.employeeBenefit.update({
      where: { id: enrollmentId },
      data: {
        documentsVerified: true,
        history: {
          create: {
            action: 'documents_verified',
            changedBy: verifiedBy,
          },
        },
      },
    });
  }

  async activateEnrollment(enrollmentId: string, activatedBy: string, memberNumber?: string): Promise<any> {
    const enrollment = await this.prisma.employeeBenefit.update({
      where: { id: enrollmentId },
      data: {
        status: 'active',
        memberNumber,
        history: {
          create: {
            action: 'activated',
            changedBy: activatedBy,
            details: { memberNumber },
          },
        },
      },
    });

    return enrollment;
  }

  async cancelEnrollment(enrollmentId: string, cancelledBy: string, endDate: Date): Promise<void> {
    await this.prisma.employeeBenefit.update({
      where: { id: enrollmentId },
      data: {
        status: 'cancelled',
        endDate,
        history: {
          create: {
            action: 'cancelled',
            changedBy: cancelledBy,
            details: { endDate: endDate.toISOString() },
          },
        },
      },
    });
  }

  async getEnrollmentHistory(enrollmentId: string): Promise<any[]> {
    return this.prisma.benefitEnrollmentHistory.findMany({
      where: { enrollmentId },
      orderBy: { changedAt: 'desc' },
    });
  }
}
