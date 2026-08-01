import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportValidator, ImportRowIssue } from './base-import.validator';

@Injectable()
export class OrgUnitsValidator extends BaseImportValidator {
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

    const fileRows = job.rows.map((r) => ({
      row: r,
      payload: r.payloadJson as Record<string, unknown>,
    }));

    const fileOrgUnitKeys = new Set<string>();
    for (const entry of fileRows) {
      const p = entry.payload;
      const le = (p.legal_entity_code as string)?.trim?.() ?? p.legal_entity_code;
      const ou = (p.org_unit_code as string)?.trim?.() ?? p.org_unit_code;
      if (ou && le) {
        fileOrgUnitKeys.add(`${le}::${ou}`);
      }
    }

    const existingOrgUnits = await this.prisma.orgUnit.findMany({
      select: { id: true, code: true, legalEntityId: true },
    });
    const legalEntityIdToCode = new Map(legalEntities.map((le) => [le.id, le.code]));
    const existingOrgUnitKeys = new Set(
      existingOrgUnits.map((ou) => `${legalEntityIdToCode.get(ou.legalEntityId)}::${ou.code}`),
    );

    for (const entry of fileRows) {
      const row = entry.row;
      const payload = entry.payload;
      const issues: ImportRowIssue[] = [];

      const org_unit_code = (payload.org_unit_code as string)?.trim?.() ?? (payload.org_unit_code as string);
      const org_unit_name = (payload.org_unit_name as string)?.trim?.() ?? (payload.org_unit_name as string);
      const parent_org_unit_code =
        (payload.parent_org_unit_code as string)?.trim?.() || null;
      const legal_entity_code =
        (payload.legal_entity_code as string)?.trim?.() ?? (payload.legal_entity_code as string);

      const mapped = {
        org_unit_code,
        org_unit_name,
        parent_org_unit_code,
        legal_entity_code,
      };

      if (!org_unit_code) {
        issues.push({
          fieldName: 'org_unit_code',
          errorCode: 'REQUIRED',
          message: 'org_unit_code is required',
          severity: 'ERROR',
        });
      }

      if (!org_unit_name) {
        issues.push({
          fieldName: 'org_unit_name',
          errorCode: 'REQUIRED',
          message: 'org_unit_name is required',
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

      const uniqueKey = `${legal_entity_code}::${org_unit_code}`;
      if (org_unit_code && legal_entity_code) {
        if (seenKeys.has(uniqueKey)) {
          issues.push({
            fieldName: 'org_unit_code',
            errorCode: 'DUPLICATE_IN_FILE',
            message: `Duplicate org unit '${org_unit_code}' for legal entity '${legal_entity_code}' in file`,
            severity: 'ERROR',
          });
        } else {
          seenKeys.add(uniqueKey);
        }
      }

      if (
        parent_org_unit_code &&
        org_unit_code &&
        parent_org_unit_code === org_unit_code
      ) {
        issues.push({
          fieldName: 'parent_org_unit_code',
          errorCode: 'INVALID_PARENT',
          message: 'parent_org_unit_code cannot equal org_unit_code',
          severity: 'ERROR',
        });
      }

      if (parent_org_unit_code && legal_entity_code) {
        const parentKey = `${legal_entity_code}::${parent_org_unit_code}`;
        const parentExists = fileOrgUnitKeys.has(parentKey) || existingOrgUnitKeys.has(parentKey);
        if (!parentExists) {
          issues.push({
            fieldName: 'parent_org_unit_code',
            errorCode: 'NOT_FOUND',
            message: `parent_org_unit_code '${parent_org_unit_code}' not found for legal entity '${legal_entity_code}'`,
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
