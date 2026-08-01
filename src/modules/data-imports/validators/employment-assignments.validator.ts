import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportValidator, ImportRowIssue } from './base-import.validator';

@Injectable()
export class EmploymentAssignmentsValidator extends BaseImportValidator {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async validate(job: { id: string; rows: Array<{ id: string; rowNumber: number; payloadJson: unknown }> }) {
    let valid = 0;
    let invalid = 0;
    let warnings = 0;
    let errors = 0;

    const employees = await this.prisma.employee.findMany({ select: { id: true, employeeNo: true } });
    const employeeByNo = new Map(employees.map((e) => [e.employeeNo, e]));

    const legalEntities = await this.prisma.legalEntity.findMany({ select: { id: true, code: true } });
    const legalEntityByCode = new Map(legalEntities.map((le) => [le.code, le]));

    const orgUnits = await this.prisma.orgUnit.findMany({
      select: { id: true, code: true, legalEntityId: true },
    });
    const orgUnitByKey = new Map(orgUnits.map((ou) => [`${ou.legalEntityId}::${ou.code}`, ou]));

    const costCenters = await this.prisma.costCenter.findMany({
      select: { id: true, costCenterCode: true, legalEntityId: true },
    });
    const costCenterByKey = new Map(
      costCenters.map((cc) => [`${cc.legalEntityId}::${cc.costCenterCode}`, cc]),
    );

    const positions = await this.prisma.position.findMany({
      select: {
        id: true,
        positionCode: true,
        legalEntityId: true,
        orgUnitId: true,
      },
    });
    const positionByKey = new Map(
      positions.map((p) => [`${p.legalEntityId}::${p.positionCode}`, p]),
    );

    const employments = await this.prisma.employment.findMany({
      select: {
        id: true,
        employeeId: true,
        legalEntityId: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    const existingAssignments = await this.prisma.employmentAssignment.findMany({
      select: {
        id: true,
        employmentId: true,
        positionId: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    for (const row of job.rows) {
      const payload = row.payloadJson as Record<string, unknown>;
      const issues: ImportRowIssue[] = [];

      const employee_no = (payload.employee_no as string)?.trim?.() ?? (payload.employee_no as string);
      let legal_entity_code =
        (payload.legal_entity_code as string)?.trim?.() ?? (payload.legal_entity_code as string) ?? null;
      const org_unit_code = (payload.org_unit_code as string)?.trim?.() ?? (payload.org_unit_code as string);
      const cost_center_code = (payload.cost_center_code as string)?.trim?.() || null;
      const position_code = (payload.position_code as string)?.trim?.() || null;
      const effective_from = (payload.effective_from as string) || null;
      const effective_to = (payload.effective_to as string) || null;

      if (!employee_no) {
        issues.push({
          fieldName: 'employee_no',
          errorCode: 'REQUIRED',
          message: 'employee_no is required',
          severity: 'ERROR',
        });
      }

      // Infer legal_entity_code from the employee's employment when not provided
      if (!legal_entity_code && employee_no) {
        const employee = employeeByNo.get(employee_no);
        if (employee) {
          const empEmployments = employments.filter((e) => e.employeeId === employee.id);
          if (empEmployments.length === 1) {
            const le = legalEntities.find((l) => l.id === empEmployments[0].legalEntityId);
            if (le) legal_entity_code = le.code;
          } else if (empEmployments.length > 1) {
            issues.push({
              fieldName: 'legal_entity_code',
              errorCode: 'REQUIRED',
              message: 'legal_entity_code is required when employee has multiple employments',
              severity: 'ERROR',
            });
          }
        }
      }

      if (!legal_entity_code && issues.length === 0) {
        if (legalEntities.length === 1) {
          legal_entity_code = legalEntities[0].code;
        } else {
          issues.push({
            fieldName: 'legal_entity_code',
            errorCode: 'REQUIRED',
            message: 'legal_entity_code is required when multiple legal entities exist',
            severity: 'ERROR',
          });
        }
      }

      const mapped = {
        employee_no,
        legal_entity_code,
        org_unit_code,
        cost_center_code,
        position_code,
        effective_from,
        effective_to,
      };

      if (!org_unit_code) {
        issues.push({
          fieldName: 'org_unit_code',
          errorCode: 'REQUIRED',
          message: 'org_unit_code is required',
          severity: 'ERROR',
        });
      }

      if (!effective_from) {
        issues.push({
          fieldName: 'effective_from',
          errorCode: 'REQUIRED',
          message: 'effective_from is required',
          severity: 'ERROR',
        });
      }

      if (effective_from && effective_to) {
        const from = new Date(effective_from);
        const to = new Date(effective_to);
        if (to < from) {
          issues.push({
            fieldName: 'effective_to',
            errorCode: 'INVALID_DATE_RANGE',
            message: 'effective_to cannot be before effective_from',
            severity: 'ERROR',
          });
        }
      }

      const employee = mapped.employee_no ? employeeByNo.get(mapped.employee_no) : null;
      if (mapped.employee_no && !employee) {
        issues.push({
          fieldName: 'employee_no',
          errorCode: 'NOT_FOUND',
          message: `employee_no '${mapped.employee_no}' not found`,
          severity: 'ERROR',
        });
      }

      const legalEntity = mapped.legal_entity_code
        ? legalEntityByCode.get(mapped.legal_entity_code)
        : null;

      if (mapped.legal_entity_code && !legalEntity) {
        issues.push({
          fieldName: 'legal_entity_code',
          errorCode: 'NOT_FOUND',
          message: `legal_entity_code '${mapped.legal_entity_code}' not found`,
          severity: 'ERROR',
        });
      }

      let employment: { id: string } | null = null;
      if (employee && legalEntity) {
        const matchingEmployments = employments.filter(
          (e) => e.employeeId === employee.id && e.legalEntityId === legalEntity.id,
        );

        if (matchingEmployments.length === 0) {
          issues.push({
            fieldName: 'employee_no',
            errorCode: 'EMPLOYMENT_NOT_FOUND',
            message: `No employment found for employee '${mapped.employee_no}' in legal entity '${mapped.legal_entity_code}'`,
            severity: 'ERROR',
          });
        } else if (matchingEmployments.length > 1) {
          issues.push({
            fieldName: 'employee_no',
            errorCode: 'AMBIGUOUS_EMPLOYMENT',
            message: `Multiple employments found for employee '${mapped.employee_no}' in legal entity '${mapped.legal_entity_code}'. Add more disambiguation to the import format.`,
            severity: 'ERROR',
          });
        } else {
          employment = matchingEmployments[0];
        }
      }

      let orgUnit: { id: string } | null = null;
      if (legalEntity && mapped.org_unit_code) {
        orgUnit = orgUnitByKey.get(`${legalEntity.id}::${mapped.org_unit_code}`) ?? null;
        if (!orgUnit) {
          issues.push({
            fieldName: 'org_unit_code',
            errorCode: 'NOT_FOUND',
            message: `org_unit_code '${mapped.org_unit_code}' not found for legal entity '${mapped.legal_entity_code}'`,
            severity: 'ERROR',
          });
        }
      }

      if (legalEntity && mapped.cost_center_code) {
        const costCenter = costCenterByKey.get(
          `${legalEntity.id}::${mapped.cost_center_code}`,
        );
        if (!costCenter) {
          issues.push({
            fieldName: 'cost_center_code',
            errorCode: 'NOT_FOUND',
            message: `cost_center_code '${mapped.cost_center_code}' not found for legal entity '${mapped.legal_entity_code}'`,
            severity: 'ERROR',
          });
        }
      }

      let position: { id: string; orgUnitId: string } | null = null;
      if (legalEntity && mapped.position_code) {
        position =
          positionByKey.get(`${legalEntity.id}::${mapped.position_code}`) ?? null;
        if (!position) {
          issues.push({
            fieldName: 'position_code',
            errorCode: 'NOT_FOUND',
            message: `position_code '${mapped.position_code}' not found for legal entity '${mapped.legal_entity_code}'`,
            severity: 'ERROR',
          });
        }
      }

      if (position && orgUnit && position.orgUnitId !== orgUnit.id) {
        issues.push({
          fieldName: 'position_code',
          errorCode: 'ORG_UNIT_MISMATCH',
          message: `position '${mapped.position_code}' does not belong to org unit '${mapped.org_unit_code}'`,
          severity: 'ERROR',
        });
      }

      if (employment && effective_from) {
        const newFrom = new Date(effective_from);
        const newTo = effective_to ? new Date(effective_to) : null;

        const overlapsEmployment = existingAssignments.some((a) => {
          if (a.employmentId !== employment!.id) return false;
          const existingFrom = new Date(a.effectiveFrom);
          const existingTo = a.effectiveTo ? new Date(a.effectiveTo) : null;
          return (
            existingFrom <= (newTo ?? new Date('9999-12-31')) &&
            (existingTo ?? new Date('9999-12-31')) >= newFrom
          );
        });

        if (overlapsEmployment) {
          issues.push({
            fieldName: 'effective_from',
            errorCode: 'OVERLAP_EMPLOYMENT',
            message: `Assignment overlaps an existing assignment for employee '${mapped.employee_no}' — will be updated`,
            severity: 'WARNING',
          });
        }
      }

      if (position && effective_from) {
        const newFrom = new Date(effective_from);
        const newTo = effective_to ? new Date(effective_to) : null;

        const overlapsPosition = existingAssignments.some((a) => {
          if (a.positionId !== position!.id) return false;
          const existingFrom = new Date(a.effectiveFrom);
          const existingTo = a.effectiveTo ? new Date(a.effectiveTo) : null;
          return (
            existingFrom <= (newTo ?? new Date('9999-12-31')) &&
            (existingTo ?? new Date('9999-12-31')) >= newFrom
          );
        });

        if (overlapsPosition) {
          issues.push({
            fieldName: 'position_code',
            errorCode: 'OVERLAP_POSITION',
            message: `Position '${mapped.position_code}' already has an overlapping occupant — will be updated`,
            severity: 'WARNING',
          });
        }
      }

      const result = await this.saveRowResult(job.id, row, mapped, issues);

      if (result.isValid) valid += 1;
      else invalid += 1;

      warnings += result.warningsCount;
      errors += result.errorsCount;
    }

    return this.finalizeJob(job, { valid, invalid, warnings, errors });
  }
}
