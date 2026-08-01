import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

const TENANT_ID = 'default';

interface CandidateScore {
  employeeId: string;
  firstName: string;
  lastName: string;
  sameUnitDirectReports: number;
  totalDirectReports: number;
  directReportsRatio: number;
  isOnlyManagerInUnit: boolean;
  score: number;
  confidence: number;
  reasonCode: string;
  reasonDetails: string;
  runnerUp?: {
    employeeName: string;
    sameUnitDirectReports: number;
    totalDirectReports: number;
    directReportsRatio: number;
    score: number;
  };
}

function confidenceBand(c: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (c >= 85) return 'HIGH';
  if (c >= 60) return 'MEDIUM';
  return 'LOW';
}

@Injectable()
export class OrgUnitManagerInferenceService {
  private readonly logger = new Logger(OrgUnitManagerInferenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateSuggestions(): Promise<{ generated: number; staled: number }> {
    const orgUnits = await this.prisma.orgUnit.findMany({
      where: { isActive: true, managerEmployeeId: null },
      select: { id: true, code: true, name: true },
    });

    if (orgUnits.length === 0) return { generated: 0, staled: 0 };

    // Mark existing PENDING suggestions as STALE before regenerating
    const staled = await this.prisma.orgUnitManagerSuggestion.updateMany({
      where: { tenantId: TENANT_ID, status: 'PENDING' },
      data: { status: 'STALE' },
    });

    let generated = 0;

    for (const ou of orgUnits) {
      const candidate = await this.computeBestCandidate(ou.id);
      if (!candidate) continue;
      if (confidenceBand(candidate.confidence) === 'LOW') continue;

      const meta = {
        score: candidate.score,
        sameUnitDirectReports: candidate.sameUnitDirectReports,
        totalDirectReports: candidate.totalDirectReports,
        directReportsRatio: candidate.directReportsRatio,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        runnerUp: candidate.runnerUp ?? null,
      } as any;

      await this.prisma.orgUnitManagerSuggestion.upsert({
        where: {
          tenantId_orgUnitId_status: {
            tenantId: TENANT_ID,
            orgUnitId: ou.id,
            status: 'PENDING',
          },
        },
        update: {
          suggestedEmployeeId: candidate.employeeId,
          confidenceScore: candidate.confidence,
          reasonCode: candidate.reasonCode,
          reasonDetails: candidate.reasonDetails,
          generatedAt: new Date(),
          metadata: meta,
        },
        create: {
          tenantId: TENANT_ID,
          orgUnitId: ou.id,
          suggestedEmployeeId: candidate.employeeId,
          confidenceScore: candidate.confidence,
          reasonCode: candidate.reasonCode,
          reasonDetails: candidate.reasonDetails,
          metadata: meta,
        },
      });
      generated++;
      this.logger.log(
        `Suggestion for ${ou.code}: ${candidate.firstName} ${candidate.lastName} ` +
        `(confidence=${candidate.confidence}, reason=${candidate.reasonCode})`,
      );
    }

    return { generated, staled: staled.count };
  }

  private async computeBestCandidate(orgUnitId: string): Promise<CandidateScore | null> {
    const assignments = await this.prisma.employmentAssignment.findMany({
      where: { orgUnitId, effectiveTo: null },
      select: { employment: { select: { employeeId: true } } },
    });
    const employeeIds = [...new Set(assignments.map((a) => a.employment.employeeId))];
    if (employeeIds.length === 0) return null;

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds }, status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        directReports: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
    });

    if (employees.length === 0) return null;

    // Get set of employees in this unit for same-unit report counting
    const unitEmployeeSet = new Set(employeeIds);

    const totalUnitEmployees = employees.length;

    const scored: CandidateScore[] = employees.map((emp) => {
      const totalDirectReports = emp.directReports.length;
      const sameUnitDirectReports = emp.directReports.filter((r) => unitEmployeeSet.has(r.id)).length;
      const managersInUnit = employees.filter((e) => e.directReports.length > 0).length;
      const isOnlyManagerInUnit = managersInUnit === 1 && totalDirectReports > 0;
      const directReportsRatio = totalUnitEmployees > 1
        ? sameUnitDirectReports / (totalUnitEmployees - 1)
        : 0;

      // manages 4/5 → ratio 0.8 → bonus ~6.4
      // manages 4/40 → ratio 0.1 → bonus ~0.8
      const ratioBonus = Math.round(directReportsRatio * 8 * 10) / 10;

      const score =
        sameUnitDirectReports * 5 +
        totalDirectReports * 2 +
        ratioBonus +
        (isOnlyManagerInUnit ? 10 : 0);

      return {
        employeeId: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        sameUnitDirectReports,
        totalDirectReports,
        directReportsRatio: Math.round(directReportsRatio * 100) / 100,
        isOnlyManagerInUnit,
        score,
        confidence: 0,
        reasonCode: '',
        reasonDetails: '',
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score === 0) return null;

    const secondBest = scored[1];
    const hasTie = secondBest && secondBest.score === best.score;
    const scoreDelta = secondBest ? best.score - secondBest.score : best.score;

    // Normalize confidence to 0-100
    let confidence: number;
    if (best.isOnlyManagerInUnit && best.sameUnitDirectReports >= 2) {
      confidence = 95;
    } else if (best.sameUnitDirectReports >= 3 && !hasTie) {
      confidence = 90;
    } else if (best.sameUnitDirectReports >= 1 && !hasTie) {
      confidence = 80;
    } else if (best.totalDirectReports >= 2 && !hasTie) {
      confidence = 70;
    } else if (hasTie) {
      confidence = 50;
    } else {
      confidence = Math.min(60, 30 + scoreDelta * 5);
    }

    // Determine reason
    let reasonCode: string;
    let reasonDetails: string;

    const ratioPercent = Math.round(best.directReportsRatio * 100);

    if (best.isOnlyManagerInUnit) {
      reasonCode = 'ONLY_MANAGER_IN_UNIT';
      reasonDetails = `Only employee in this unit who manages others (${best.totalDirectReports} direct reports, ${ratioPercent}% of unit)`;
    } else if (best.sameUnitDirectReports > 0 && best.sameUnitDirectReports >= (secondBest?.sameUnitDirectReports ?? 0) + 2) {
      reasonCode = 'MOST_DIRECT_REPORTS_IN_UNIT';
      reasonDetails = `Manages ${best.sameUnitDirectReports} of ${totalUnitEmployees} employees in this unit (${ratioPercent}%)`;
    } else if (best.totalDirectReports > 0) {
      reasonCode = 'HIGHEST_REPORT_RATIO';
      reasonDetails = `Has ${best.totalDirectReports} total direct reports (${best.sameUnitDirectReports} in this unit, ${ratioPercent}% coverage)`;
    } else {
      reasonCode = 'LOW_CONFIDENCE_TIE';
      reasonDetails = 'Multiple candidates with similar profiles';
    }

    if (hasTie) {
      reasonDetails += ' (tie with another candidate — review recommended)';
    }

    best.confidence = confidence;
    best.reasonCode = reasonCode;
    best.reasonDetails = reasonDetails;

    if (secondBest) {
      best.runnerUp = {
        employeeName: `${secondBest.firstName} ${secondBest.lastName}`,
        sameUnitDirectReports: secondBest.sameUnitDirectReports,
        totalDirectReports: secondBest.totalDirectReports,
        directReportsRatio: secondBest.directReportsRatio,
        score: secondBest.score,
      };
    }

    return best;
  }

  async acceptSuggestion(suggestionId: string, userId: string) {
    const suggestion = await this.prisma.orgUnitManagerSuggestion.findUniqueOrThrow({
      where: { id: suggestionId },
    });

    await this.prisma.$transaction([
      this.prisma.orgUnit.update({
        where: { id: suggestion.orgUnitId },
        data: {
          managerEmployeeId: suggestion.suggestedEmployeeId,
          managerAssignmentSource: 'INFERRED_ACCEPTED',
          managerAssignmentConfidence: suggestion.confidenceScore,
          managerAssignmentUpdatedAt: new Date(),
          managerAssignmentUpdatedByUserId: userId,
        },
      }),
      this.prisma.orgUnitManagerSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          reviewedAt: new Date(),
          reviewedByUserId: userId,
        },
      }),
    ]);
  }

  async rejectSuggestion(suggestionId: string, userId: string) {
    await this.prisma.orgUnitManagerSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });
  }

  async listSuggestions(filters?: {
    legalEntityId?: string;
    orgUnitId?: string;
    status?: string;
    confidenceBand?: string;
  }) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID };
    if (filters?.orgUnitId) where.orgUnitId = filters.orgUnitId;
    if (filters?.status) where.status = filters.status;

    const suggestions = await this.prisma.orgUnitManagerSuggestion.findMany({
      where: where as any,
      include: {
        orgUnit: {
          select: { id: true, code: true, name: true, legalEntityId: true },
        },
      },
      orderBy: { confidenceScore: 'desc' },
    });

    // Enrich with employee names and filter by legalEntityId/confidenceBand
    const employeeIds = suggestions.map((s) => s.suggestedEmployeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    let results = suggestions.map((s) => {
      const emp = empMap.get(s.suggestedEmployeeId);
      const meta = (s.metadata ?? {}) as Record<string, unknown>;
      const runnerUp = meta.runnerUp as { employeeName: string; sameUnitDirectReports: number; totalDirectReports: number; score: number } | undefined;

      return {
        id: s.id,
        orgUnitId: s.orgUnitId,
        orgUnitCode: s.orgUnit.code,
        orgUnitName: s.orgUnit.name,
        legalEntityId: s.orgUnit.legalEntityId,
        suggestedEmployeeId: s.suggestedEmployeeId,
        suggestedEmployeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        suggestedEmployeeNo: emp?.employeeNo,
        confidenceScore: s.confidenceScore,
        confidenceBand: confidenceBand(s.confidenceScore),
        reasonCode: s.reasonCode,
        reasonDetails: s.reasonDetails,
        runnerUp: runnerUp ?? null,
        status: s.status,
        generatedAt: s.generatedAt,
        reviewedAt: s.reviewedAt,
        acceptedAt: s.acceptedAt,
        rejectedAt: s.rejectedAt,
      };
    });

    if (filters?.legalEntityId) {
      results = results.filter((r) => r.legalEntityId === filters.legalEntityId);
    }
    if (filters?.confidenceBand) {
      results = results.filter((r) => r.confidenceBand === filters.confidenceBand);
    }

    return results;
  }

  async bulkAccept(filters: { confidenceBand?: string }, userId: string) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID, status: 'PENDING' };

    const suggestions = await this.prisma.orgUnitManagerSuggestion.findMany({
      where: where as any,
    });

    let filtered = suggestions;
    if (filters.confidenceBand) {
      filtered = suggestions.filter((s) => confidenceBand(s.confidenceScore) === filters.confidenceBand);
    }

    let accepted = 0;
    for (const s of filtered) {
      await this.acceptSuggestion(s.id, userId);
      accepted++;
    }

    return { accepted, total: filtered.length };
  }

  async getMetrics() {
    const [pending, accepted, rejected, stale] = await Promise.all([
      this.prisma.orgUnitManagerSuggestion.count({ where: { tenantId: TENANT_ID, status: 'PENDING' } }),
      this.prisma.orgUnitManagerSuggestion.count({ where: { tenantId: TENANT_ID, status: 'ACCEPTED' } }),
      this.prisma.orgUnitManagerSuggestion.count({ where: { tenantId: TENANT_ID, status: 'REJECTED' } }),
      this.prisma.orgUnitManagerSuggestion.count({ where: { tenantId: TENANT_ID, status: 'STALE' } }),
    ]);

    const pendingSuggestions = await this.prisma.orgUnitManagerSuggestion.findMany({
      where: { tenantId: TENANT_ID, status: 'PENDING' },
      select: { confidenceScore: true },
    });

    const byBand = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const s of pendingSuggestions) {
      byBand[confidenceBand(s.confidenceScore)]++;
    }

    const total = accepted + rejected;
    const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : null;

    return {
      pending, accepted, rejected, stale,
      total: pending + accepted + rejected + stale,
      acceptanceRate,
      confidenceDistribution: byBand,
      churnRate: pending + stale > 0 ? Math.round((stale / (pending + stale)) * 100) : 0,
    };
  }

  /**
   * Checks all PENDING suggestions and marks any as STALE if:
   * - The suggested employee is no longer active in the org unit
   * - The suggested employee no longer has direct reports
   * - The org unit already has a confirmed manager
   * Returns the number of suggestions marked stale.
   */
  async reconcileStaleSuggestions(): Promise<number> {
    const pending = await this.prisma.orgUnitManagerSuggestion.findMany({
      where: { tenantId: TENANT_ID, status: 'PENDING' },
      include: {
        orgUnit: { select: { id: true, managerEmployeeId: true, isActive: true } },
      },
    });

    if (pending.length === 0) return 0;

    const staleIds: string[] = [];

    for (const s of pending) {
      // Org unit already has a confirmed manager
      if (s.orgUnit.managerEmployeeId) {
        staleIds.push(s.id);
        continue;
      }

      // Org unit is no longer active
      if (!s.orgUnit.isActive) {
        staleIds.push(s.id);
        continue;
      }

      // Check if the suggested employee is still assigned to this org unit
      const activeAssignment = await this.prisma.employmentAssignment.findFirst({
        where: {
          orgUnitId: s.orgUnitId,
          effectiveTo: null,
          employment: { employeeId: s.suggestedEmployeeId },
        },
      });
      if (!activeAssignment) {
        staleIds.push(s.id);
        this.logger.log(`Suggestion ${s.id} stale: employee ${s.suggestedEmployeeId} no longer in org unit ${s.orgUnitId}`);
        continue;
      }

      // Check if the suggested employee still has active direct reports
      const employee = await this.prisma.employee.findUnique({
        where: { id: s.suggestedEmployeeId },
        select: {
          status: true,
          _count: { select: { directReports: true } },
        },
      });
      if (!employee || employee.status !== 'ACTIVE' || employee._count.directReports === 0) {
        staleIds.push(s.id);
        this.logger.log(`Suggestion ${s.id} stale: employee ${s.suggestedEmployeeId} inactive or lost all reports`);
        continue;
      }
    }

    if (staleIds.length > 0) {
      await this.prisma.orgUnitManagerSuggestion.updateMany({
        where: { id: { in: staleIds } },
        data: { status: 'STALE' },
      });
      this.logger.log(`Reconciled ${staleIds.length} stale suggestion(s)`);
    }

    return staleIds.length;
  }

  async assignManagerManually(orgUnitId: string, employeeId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.orgUnit.update({
        where: { id: orgUnitId },
        data: {
          managerEmployeeId: employeeId,
          managerAssignmentSource: 'MANUAL',
          managerAssignmentConfidence: null,
          managerAssignmentUpdatedAt: new Date(),
          managerAssignmentUpdatedByUserId: userId,
        },
      }),
      // Mark any pending suggestion for this org unit as STALE
      this.prisma.orgUnitManagerSuggestion.updateMany({
        where: { tenantId: TENANT_ID, orgUnitId, status: 'PENDING' },
        data: { status: 'STALE' },
      }),
    ]);
  }
}
