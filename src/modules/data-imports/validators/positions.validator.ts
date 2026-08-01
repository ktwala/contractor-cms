import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportValidator, ImportRowIssue } from './base-import.validator';

@Injectable()
export class PositionsValidator extends BaseImportValidator {
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

    const orgUnits = await this.prisma.orgUnit.findMany({
      select: { id: true, code: true, legalEntityId: true },
    });
    const legalEntityIdToCode = new Map(legalEntities.map((le) => [le.id, le.code]));
    const orgUnitByKey = new Map(
      orgUnits.map((ou) => [`${legalEntityIdToCode.get(ou.legalEntityId)}::${ou.code}`, ou]),
    );

    const existing = await this.prisma.position.findMany({
      select: { positionCode: true, legalEntityId: true },
    });
    const existingKeys = new Set(
      existing.map((p) => `${legalEntityIdToCode.get(p.legalEntityId)}::${p.positionCode}`),
    );

    for (const row of job.rows) {
      const payload = row.payloadJson as Record<string, unknown>;
      const issues: ImportRowIssue[] = [];

      const position_code =
        (payload.position_code as string)?.trim?.() ?? (payload.position_code as string);
      const position_title =
        (payload.position_title as string)?.trim?.() ?? (payload.position_title as string);
      const org_unit_code =
        (payload.org_unit_code as string)?.trim?.() ?? (payload.org_unit_code as string);
      const legal_entity_code =
        (payload.legal_entity_code as string)?.trim?.() ?? (payload.legal_entity_code as string);

      const mapped = { position_code, position_title, org_unit_code, legal_entity_code };

      if (!position_code) {
        issues.push({
          fieldName: 'position_code',
          errorCode: 'REQUIRED',
          message: 'position_code is required',
          severity: 'ERROR',
        });
      }

      if (!position_title) {
        issues.push({
          fieldName: 'position_title',
          errorCode: 'REQUIRED',
          message: 'position_title is required',
          severity: 'ERROR',
        });
      }

      if (!org_unit_code) {
        issues.push({
          fieldName: 'org_unit_code',
          errorCode: 'REQUIRED',
          message: 'org_unit_code is required',
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

      const orgUnitKey = `${legal_entity_code}::${org_unit_code}`;
      if (org_unit_code && legal_entity_code && !orgUnitByKey.has(orgUnitKey)) {
        issues.push({
          fieldName: 'org_unit_code',
          errorCode: 'NOT_FOUND',
          message: `org_unit_code '${org_unit_code}' not found for legal entity '${legal_entity_code}'`,
          severity: 'ERROR',
        });
      }

      const uniqueKey = `${legal_entity_code}::${position_code}`;
      if (position_code && legal_entity_code) {
        if (seenKeys.has(uniqueKey)) {
          issues.push({
            fieldName: 'position_code',
            errorCode: 'DUPLICATE_IN_FILE',
            message: `Duplicate position '${position_code}' for legal entity '${legal_entity_code}' in file`,
            severity: 'ERROR',
          });
        } else {
          seenKeys.add(uniqueKey);
        }

        if (existingKeys.has(uniqueKey)) {
          issues.push({
            fieldName: 'position_code',
            errorCode: 'ALREADY_EXISTS',
            message: `position_code '${position_code}' already exists for legal entity '${legal_entity_code}' — will be updated`,
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
