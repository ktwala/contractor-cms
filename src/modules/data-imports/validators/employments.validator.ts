import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportValidator, ImportRowIssue } from './base-import.validator';

@Injectable()
export class EmploymentsValidator extends BaseImportValidator {
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

    const payGroups = await this.prisma.payGroup.findMany({ select: { id: true, code: true, legalEntityId: true } });
    const payGroupByKey = new Map(payGroups.map((pg) => [`${pg.legalEntityId}::${pg.code}`, pg]));

    for (const row of job.rows) {
      const payload = row.payloadJson as Record<string, unknown>;
      const issues: ImportRowIssue[] = [];

      const employee_no = (payload.employee_no as string)?.trim?.() ?? (payload.employee_no as string);
      const legal_entity_code =
        (payload.legal_entity_code as string)?.trim?.() ?? (payload.legal_entity_code as string);
      const pay_group_code = (payload.pay_group_code as string)?.trim?.() ?? (payload.pay_group_code as string);
      const effective_from =
        (payload.effective_from as string) || (payload.hire_date as string) || null;
      const hire_date = (payload.hire_date as string) || effective_from;
      const job_title = (payload.job_title as string)?.trim?.() || null;
      const effective_to =
        (payload.effective_to as string) || (payload.termination_date as string) || null;
      const employment_type = (payload.employment_type as string)?.trim?.() || null;

      const mapped = {
        employee_no,
        legal_entity_code,
        pay_group_code,
        hire_date,
        effective_from: effective_from || hire_date,
        employment_type,
        job_title,
        effective_to,
      };

      if (!employee_no) {
        issues.push({
          fieldName: 'employee_no',
          errorCode: 'REQUIRED',
          message: 'employee_no is required',
          severity: 'ERROR',
        });
      }

      if (!legal_entity_code) {
        issues.push({
          fieldName: 'legal_entity_code',
          errorCode: 'REQUIRED',
          message: 'legal_entity_code is required',
          severity: 'ERROR',
        });
      }

      if (!effective_from && !hire_date) {
        issues.push({
          fieldName: 'effective_from',
          errorCode: 'REQUIRED',
          message: 'effective_from or hire_date is required',
          severity: 'ERROR',
        });
      }

      if (employee_no && !employeeByNo.has(employee_no)) {
        issues.push({
          fieldName: 'employee_no',
          errorCode: 'NOT_FOUND',
          message: `employee_no '${employee_no}' not found`,
          severity: 'ERROR',
        });
      }

      if (legal_entity_code && !legalEntityByCode.has(legal_entity_code)) {
        issues.push({
          fieldName: 'legal_entity_code',
          errorCode: 'NOT_FOUND',
          message: `legal_entity_code '${legal_entity_code}' not found`,
          severity: 'ERROR',
        });
      }

      const legalEntity = legal_entity_code ? legalEntityByCode.get(legal_entity_code) : null;
      if (legal_entity_code && pay_group_code && legalEntity) {
        const pgKey = `${legalEntity.id}::${pay_group_code}`;
        if (!payGroupByKey.has(pgKey)) {
          issues.push({
            fieldName: 'pay_group_code',
            errorCode: 'NOT_FOUND',
            message: `pay_group_code '${pay_group_code}' not found for legal entity '${legal_entity_code}'`,
            severity: 'ERROR',
          });
        }
      }

      if (hire_date && effective_to) {
        const hire = new Date(hire_date);
        const term = new Date(effective_to);
        if (term < hire) {
          issues.push({
            fieldName: 'effective_to',
            errorCode: 'INVALID_DATE_RANGE',
            message: 'effective_to cannot be before hire_date',
            severity: 'ERROR',
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
