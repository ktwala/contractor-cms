import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportValidator, ImportRowIssue } from './base-import.validator';

@Injectable()
export class CostCentersValidator extends BaseImportValidator {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async validate(job: { id: string; rows: Array<{ id: string; rowNumber: number; payloadJson: unknown }> }) {
    let valid = 0;
    let invalid = 0;
    let warnings = 0;
    let errors = 0;

    const seenKeys = new Set<string>();

    const legalEntities = await this.prisma.legalEntity.findMany({ select: { id: true, code: true } });
    const legalEntityByCode = new Map(legalEntities.map((le) => [le.code, le]));

    const existing = await this.prisma.costCenter.findMany({
      select: { costCenterCode: true, legalEntityId: true },
    });
    const legalEntityIdToCode = new Map(legalEntities.map((le) => [le.id, le.code]));
    const existingKeys = new Set(
      existing.map((cc) => `${legalEntityIdToCode.get(cc.legalEntityId)}::${cc.costCenterCode}`),
    );

    for (const row of job.rows) {
      const payload = row.payloadJson as Record<string, unknown>;
      const issues: ImportRowIssue[] = [];

      const cost_center_code =
        (payload.cost_center_code as string)?.trim?.() ?? (payload.cost_center_code as string);
      const cost_center_name =
        (payload.cost_center_name as string)?.trim?.() ?? (payload.cost_center_name as string);
      const legal_entity_code =
        (payload.legal_entity_code as string)?.trim?.() ?? (payload.legal_entity_code as string);

      const mapped = { cost_center_code, cost_center_name, legal_entity_code };

      if (!cost_center_code) {
        issues.push({
          fieldName: 'cost_center_code',
          errorCode: 'REQUIRED',
          message: 'cost_center_code is required',
          severity: 'ERROR',
        });
      }

      if (!cost_center_name) {
        issues.push({
          fieldName: 'cost_center_name',
          errorCode: 'REQUIRED',
          message: 'cost_center_name is required',
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

      const legalEntity = legal_entity_code ? legalEntityByCode.get(legal_entity_code) : null;
      if (legal_entity_code && !legalEntity) {
        issues.push({
          fieldName: 'legal_entity_code',
          errorCode: 'NOT_FOUND',
          message: `legal_entity_code '${legal_entity_code}' not found`,
          severity: 'ERROR',
        });
      }

      const uniqueKey = `${legal_entity_code}::${cost_center_code}`;
      if (cost_center_code && legal_entity_code) {
        if (seenKeys.has(uniqueKey)) {
          issues.push({
            fieldName: 'cost_center_code',
            errorCode: 'DUPLICATE_IN_FILE',
            message: `Duplicate cost center '${cost_center_code}' for legal entity '${legal_entity_code}' in file`,
            severity: 'ERROR',
          });
        } else {
          seenKeys.add(uniqueKey);
        }

        if (existingKeys.has(uniqueKey)) {
          issues.push({
            fieldName: 'cost_center_code',
            errorCode: 'ALREADY_EXISTS',
            message: `cost_center_code '${cost_center_code}' already exists for legal entity '${legal_entity_code}' — will be updated`,
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
