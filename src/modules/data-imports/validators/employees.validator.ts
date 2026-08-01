import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportValidator, ImportRowIssue } from './base-import.validator';

@Injectable()
export class EmployeesValidator extends BaseImportValidator {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async validate(job: { id: string; rows: Array<{ id: string; rowNumber: number; payloadJson: unknown }> }) {
    let valid = 0;
    let invalid = 0;
    let warnings = 0;
    let errors = 0;

    const seenEmployeeNos = new Set<string>();

    const existingEmployees = await this.prisma.employee.findMany({ select: { employeeNo: true } });
    const existingEmployeeNos = new Set(existingEmployees.map((e) => e.employeeNo));

    const legalEntities = await this.prisma.legalEntity.findMany({ select: { id: true, code: true } });
    const legalEntityByCode = new Map(legalEntities.map((le) => [le.code, le]));

    for (const row of job.rows) {
      const payload = row.payloadJson as Record<string, unknown>;
      const issues: ImportRowIssue[] = [];

      const employee_no = (payload.employee_no as string)?.trim?.() ?? (payload.employee_no as string);
      const first_name = (payload.first_name as string)?.trim?.() ?? (payload.first_name as string);
      const last_name = (payload.last_name as string)?.trim?.() ?? (payload.last_name as string);
      const email = (payload.email as string)?.trim?.() || null;
      const phone = (payload.phone as string)?.trim?.() || null;
      const date_of_birth = (payload.date_of_birth as string) || null;
      const national_id = (payload.national_id as string)?.trim?.() || null;
      const legal_entity_code = (payload.legal_entity_code as string)?.trim?.() ?? (payload.legal_entity_code as string);
      const tax_number = (payload.tax_number as string)?.trim?.() || null;
      const residency_status = (payload.residency_status as string)?.trim?.()?.toUpperCase() || 'RESIDENT';

      const mapped = {
        employee_no,
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        national_id,
        legal_entity_code,
        tax_number,
        residency_status,
      };

      if (!employee_no) {
        issues.push({
          fieldName: 'employee_no',
          errorCode: 'REQUIRED',
          message: 'employee_no is required',
          severity: 'ERROR',
        });
      }

      if (!first_name) {
        issues.push({
          fieldName: 'first_name',
          errorCode: 'REQUIRED',
          message: 'first_name is required',
          severity: 'ERROR',
        });
      }

      if (!last_name) {
        issues.push({
          fieldName: 'last_name',
          errorCode: 'REQUIRED',
          message: 'last_name is required',
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
      } else if (!legalEntityByCode.has(legal_entity_code)) {
        issues.push({
          fieldName: 'legal_entity_code',
          errorCode: 'NOT_FOUND',
          message: `legal_entity_code '${legal_entity_code}' not found`,
          severity: 'ERROR',
        });
      }

      if (residency_status && !['RESIDENT', 'NON_RESIDENT'].includes(residency_status)) {
        issues.push({
          fieldName: 'residency_status',
          errorCode: 'INVALID_ENUM',
          message: `residency_status '${residency_status}' is invalid`,
          severity: 'ERROR',
        });
      }

      if (employee_no) {
        if (seenEmployeeNos.has(employee_no)) {
          issues.push({
            fieldName: 'employee_no',
            errorCode: 'DUPLICATE_IN_FILE',
            message: `Duplicate employee_no '${employee_no}' in file`,
            severity: 'ERROR',
          });
        } else {
          seenEmployeeNos.add(employee_no);
        }

        if (existingEmployeeNos.has(employee_no)) {
          issues.push({
            fieldName: 'employee_no',
            errorCode: 'ALREADY_EXISTS',
            message: `employee_no '${employee_no}' already exists — will be updated`,
            severity: 'WARNING',
          });
        }
      }

      if (email) {
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailOk) {
          issues.push({
            fieldName: 'email',
            errorCode: 'INVALID_FORMAT',
            message: `email '${email}' is not valid`,
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
