import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportValidator, ImportRowIssue } from './base-import.validator';

@Injectable()
export class LegalEntitiesValidator extends BaseImportValidator {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async validate(job: { id: string; rows: Array<{ id: string; rowNumber: number; payloadJson: unknown }> }) {
    let valid = 0;
    let invalid = 0;
    let warnings = 0;
    let errors = 0;

    const seenCodes = new Set<string>();

    const existing = await this.prisma.legalEntity.findMany({ select: { code: true } });
    const existingCodes = new Set(existing.map((e) => e.code));

    for (const row of job.rows) {
      const payload = row.payloadJson as Record<string, unknown>;
      const issues: ImportRowIssue[] = [];

      const code = (payload.code as string)?.trim?.() ?? (payload.code as string);
      const name = (payload.name as string)?.trim?.() ?? (payload.name as string);
      const country = (payload.country as string)?.trim?.() ?? (payload.country as string);
      const registration_no = (payload.registration_no as string)?.trim?.() || null;
      const tax_reference = (payload.tax_reference as string)?.trim?.() || null;

      const mapped = { code, name, country, registration_no, tax_reference };

      if (!code) {
        issues.push({
          fieldName: 'code',
          errorCode: 'REQUIRED',
          message: 'code is required',
          severity: 'ERROR',
        });
      }

      if (!name) {
        issues.push({
          fieldName: 'name',
          errorCode: 'REQUIRED',
          message: 'name is required',
          severity: 'ERROR',
        });
      }

      if (!country) {
        issues.push({
          fieldName: 'country',
          errorCode: 'REQUIRED',
          message: 'country is required',
          severity: 'ERROR',
        });
      }

      if (code && seenCodes.has(code)) {
        issues.push({
          fieldName: 'code',
          errorCode: 'DUPLICATE_IN_FILE',
          message: `Duplicate code '${code}' in import file`,
          severity: 'ERROR',
        });
      } else if (code) {
        seenCodes.add(code);
      }

      if (code && existingCodes.has(code)) {
        issues.push({
          fieldName: 'code',
          errorCode: 'ALREADY_EXISTS',
          message: `code '${code}' already exists — will be updated`,
          severity: 'WARNING',
        });
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
