import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportValidator, ImportRowIssue } from './base-import.validator';

@Injectable()
export class PayGroupsValidator extends BaseImportValidator {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async validate(job: { id: string; rows: Array<{ id: string; rowNumber: number; payloadJson: unknown }> }) {
    let valid = 0;
    let invalid = 0;
    let warnings = 0;
    let errors = 0;

    const seenCodes = new Set<string>();

    const legalEntities = await this.prisma.legalEntity.findMany({ select: { id: true, code: true } });
    const legalEntityByCode = new Map(legalEntities.map((le) => [le.code, le]));

    const existing = await this.prisma.payGroup.findMany({ select: { code: true } });
    const existingCodes = new Set(existing.map((pg) => pg.code));

    const validCountries = ['LS', 'ZA'];
    const validCurrencies = ['LSL', 'ZAR'];
    const validFrequencies = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'];

    for (const row of job.rows) {
      const payload = row.payloadJson as Record<string, unknown>;
      const issues: ImportRowIssue[] = [];

      const code = (payload.code as string)?.trim?.() ?? (payload.code as string);
      const name = (payload.name as string)?.trim?.() ?? (payload.name as string);
      const legal_entity_code =
        (payload.legal_entity_code as string)?.trim?.() ?? (payload.legal_entity_code as string);
      const country = ((payload.country as string)?.trim?.() ?? (payload.country as string))?.toUpperCase?.();
      const currency = ((payload.currency as string)?.trim?.() ?? (payload.currency as string))?.toUpperCase?.();
      const frequency = ((payload.frequency as string)?.trim?.() ?? (payload.frequency as string))?.toUpperCase?.();

      const mapped = { code, name, legal_entity_code, country, currency, frequency };

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

      if (!legal_entity_code) {
        issues.push({
          fieldName: 'legal_entity_code',
          errorCode: 'REQUIRED',
          message: 'legal_entity_code is required',
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
      } else if (!validCountries.includes(country)) {
        issues.push({
          fieldName: 'country',
          errorCode: 'INVALID',
          message: `country must be one of: ${validCountries.join(', ')}`,
          severity: 'ERROR',
        });
      }

      if (!currency) {
        issues.push({
          fieldName: 'currency',
          errorCode: 'REQUIRED',
          message: 'currency is required',
          severity: 'ERROR',
        });
      } else if (!validCurrencies.includes(currency)) {
        issues.push({
          fieldName: 'currency',
          errorCode: 'INVALID',
          message: `currency must be one of: ${validCurrencies.join(', ')}`,
          severity: 'ERROR',
        });
      }

      if (!frequency) {
        issues.push({
          fieldName: 'frequency',
          errorCode: 'REQUIRED',
          message: 'frequency is required',
          severity: 'ERROR',
        });
      } else if (!validFrequencies.includes(frequency)) {
        issues.push({
          fieldName: 'frequency',
          errorCode: 'INVALID',
          message: `frequency must be one of: ${validFrequencies.join(', ')}`,
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

      if (code) {
        if (seenCodes.has(code)) {
          issues.push({
            fieldName: 'code',
            errorCode: 'DUPLICATE_IN_FILE',
            message: `Duplicate code '${code}' in file`,
            severity: 'ERROR',
          });
        } else {
          seenCodes.add(code);
        }

        if (existingCodes.has(code)) {
          issues.push({
            fieldName: 'code',
            errorCode: 'ALREADY_EXISTS',
            message: `code '${code}' already exists — will be updated`,
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
