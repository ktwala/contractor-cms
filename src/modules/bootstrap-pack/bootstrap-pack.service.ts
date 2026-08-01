import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import AdmZip from 'adm-zip';
import type { IZipEntry } from 'adm-zip';
import { DataImportDatasetType } from '@prisma/client';
import { DataImportsService } from '../data-imports/data-imports.service';
import { parseImportFile } from '../data-imports/utils/file-parser';
import {
  PACK_DATASET_ORDER,
  resolveDatasetFromFilename,
  PackManifest,
} from './dto/pack-manifest.dto';
import {
  HierarchyIntegrityService,
  HierarchyIntegrityReport,
} from '../hierarchy/hierarchy-integrity.service';

/** Datasets that must exist when this dataset is present */
const DATASET_DEPENDENCIES: Partial<Record<DataImportDatasetType, DataImportDatasetType[]>> = {
  EMPLOYEES: ['LEGAL_ENTITIES'],
  EMPLOYMENTS: ['LEGAL_ENTITIES', 'EMPLOYEES'],
  EMPLOYMENT_ASSIGNMENTS: ['LEGAL_ENTITIES', 'ORG_UNITS', 'EMPLOYEES', 'EMPLOYMENTS', 'POSITIONS'],
  MANAGER_RELATIONSHIPS: ['EMPLOYEES'],
  ORG_UNITS: ['LEGAL_ENTITIES'],
  COST_CENTERS: ['LEGAL_ENTITIES'],
  POSITIONS: ['ORG_UNITS'],
  PAY_GROUPS: ['LEGAL_ENTITIES'],
};

/** Downstream datasets recommended when this one is present (e.g. EMPLOYEES → EMPLOYMENTS) */
const RECOMMENDED_DOWNSTREAM: Partial<Record<DataImportDatasetType, DataImportDatasetType[]>> = {
  EMPLOYEES: ['EMPLOYMENTS', 'MANAGER_RELATIONSHIPS'],
};

export type PackDatasetStatus = 'ready' | 'warning' | 'blocked';

export interface PackDatasetPreview {
  type: DataImportDatasetType;
  file: string;
  rows: number;
  /** blocked = hard dependency missing; warning = recommended downstream missing */
  status: PackDatasetStatus;
}

export interface PackParseResult {
  manifest: PackManifest | null;
  /** @deprecated Use datasets instead */
  files: Array<{
    filename: string;
    datasetType: DataImportDatasetType;
    rowCount: number;
  }>;
  /** Canonical dataset list for UI; sorted by dependency order */
  datasets: PackDatasetPreview[];
  warnings: string[];
  /** Dataset types that are expected but missing (e.g. EMPLOYMENTS when EMPLOYEES present) */
  missing_dependencies: string[];
  /** True if any dataset has status 'blocked' (hard dependency missing); import should be rejected */
  blocked: boolean;
}

/** Structured counts for dashboard/audit/API (snake_case keys) */
export interface PackReportSummary {
  legal_entities_created?: number;
  legal_entities_updated?: number;
  pay_groups_created?: number;
  pay_groups_updated?: number;
  org_units_created?: number;
  org_units_updated?: number;
  cost_centers_created?: number;
  cost_centers_updated?: number;
  positions_created?: number;
  positions_updated?: number;
  employees_created?: number;
  employees_updated?: number;
  employments_created?: number;
  employments_updated?: number;
  employment_assignments_created?: number;
  employment_assignments_updated?: number;
  manager_relationships_created?: number;
  manager_relationships_updated?: number;
}

export interface PackImportResult {
  success: boolean;
  summary: Record<string, { created?: number; updated?: number; errors?: number; total_rows?: number }>;
  warnings: string[];
  errors: string[];
  /** Onboarding report lines for evidence (e.g. "Legal Entities: 1 created") */
  report: string[];
  /** Structured counts for dashboard integration, audit, API consumers, tests */
  reportSummary: PackReportSummary;
  /** Post-import hierarchy integrity validation */
  manager_hierarchy_validation?: HierarchyIntegrityReport;
}

@Injectable()
export class BootstrapPackService {
  private readonly logger = new Logger(BootstrapPackService.name);

  constructor(
    private readonly dataImportsService: DataImportsService,
    private readonly hierarchyIntegrity: HierarchyIntegrityService,
  ) {}

  parsePack(buffer: Buffer): PackParseResult & { zip: AdmZip } {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const warnings: string[] = [];
    const files: PackParseResult['files'] = [];
    let manifest: PackManifest | null = null;

    const csvEntries = entries.filter(
      (e: IZipEntry) => !e.isDirectory && (e.entryName.endsWith('.csv') || e.entryName.endsWith('.json')),
    );

    for (const entry of csvEntries) {
      const filename = entry.entryName.split('/').pop() ?? entry.entryName;

      if (filename.toLowerCase() === 'manifest.json') {
        try {
          const content = entry.getData().toString('utf-8');
          manifest = JSON.parse(content) as PackManifest;
        } catch (e) {
          warnings.push('Could not parse manifest.json');
        }
        continue;
      }

      if (!filename.endsWith('.csv')) continue;

      const datasetType = resolveDatasetFromFilename(filename);
      if (!datasetType) {
        warnings.push(`Unknown dataset file: ${filename} - skipping`);
        continue;
      }

      try {
        const content = entry.getData();
        const rows = parseImportFile(content as Buffer, filename);
        files.push({
          filename,
          datasetType,
          rowCount: rows.length,
        });
      } catch (e) {
        warnings.push(`Failed to parse ${filename}: ${(e as Error).message}`);
      }
    }

    const presentTypes = new Set(files.map((f) => f.datasetType));
    const missing_dependencies: string[] = [];
    const depWarnings: string[] = [];

    for (const [dataset, deps] of Object.entries(DATASET_DEPENDENCIES)) {
      if (!presentTypes.has(dataset as DataImportDatasetType)) continue;
      for (const dep of deps ?? []) {
        if (!presentTypes.has(dep)) {
          missing_dependencies.push(`${dataset} -> ${dep}`);
          if (dataset === 'EMPLOYEES' && dep === 'LEGAL_ENTITIES') {
            depWarnings.push('EMPLOYEES requires LEGAL_ENTITIES. Add legal_entities.csv.');
          }
        }
      }
    }
    for (const [dataset, recommended] of Object.entries(RECOMMENDED_DOWNSTREAM)) {
      if (!presentTypes.has(dataset as DataImportDatasetType)) continue;
      for (const down of recommended ?? []) {
        if (!presentTypes.has(down)) {
          depWarnings.push(
            `${dataset} detected but ${down} missing. ${dataset === 'EMPLOYEES' && down === 'EMPLOYMENTS' ? 'Employees will exist without payroll/employment context.' : 'Consider adding this dataset.'}`,
          );
        }
      }
    }
    warnings.push(...depWarnings);

    const ordered = this.sortByDependency(files);
    const datasetsWithBlocked = new Set<string>();
    const datasetsWithWarning = new Set<string>();
    for (const [ds, deps] of Object.entries(DATASET_DEPENDENCIES)) {
      if (!presentTypes.has(ds as DataImportDatasetType)) continue;
      const missingHard = (deps ?? []).filter((d) => !presentTypes.has(d));
      if (missingHard.length > 0) {
        datasetsWithBlocked.add(ds);
      }
    }
    for (const [ds, recommended] of Object.entries(RECOMMENDED_DOWNSTREAM)) {
      if (!presentTypes.has(ds as DataImportDatasetType)) continue;
      if (datasetsWithBlocked.has(ds)) continue;
      const missingRec = (recommended ?? []).filter((d) => !presentTypes.has(d));
      if (missingRec.length > 0) {
        datasetsWithWarning.add(ds);
      }
    }
    const datasets: PackParseResult['datasets'] = ordered.map((f) => {
      let status: PackDatasetPreview['status'] = 'ready';
      if (datasetsWithBlocked.has(f.datasetType)) status = 'blocked';
      else if (datasetsWithWarning.has(f.datasetType)) status = 'warning';
      return {
        type: f.datasetType,
        file: f.filename,
        rows: f.rowCount,
        status,
      };
    });

    return {
      manifest,
      files,
      datasets,
      warnings,
      missing_dependencies,
      blocked: datasetsWithBlocked.size > 0,
      zip,
    };
  }

  async importPack(buffer: Buffer, fileName: string, userId: string): Promise<PackImportResult> {
    const { files, warnings, zip, blocked } = this.parsePack(buffer);

    if (files.length === 0) {
      throw new BadRequestException(
        'No valid dataset files found in pack. Expected CSV files such as legal_entities.csv, employees.csv, etc.',
      );
    }

    if (blocked) {
      throw new BadRequestException(
        'Pack has blocking dependency errors. Run Parse to see which datasets are blocked (e.g. EMPLOYEES requires LEGAL_ENTITIES). Fix the pack and try again.',
      );
    }

    const ordered = this.sortByDependency(files);
    const summary: PackImportResult['summary'] = {};
    const reportSummary: PackReportSummary = {};
    const errors: string[] = [];
    const report: string[] = [];

    for (const { filename, datasetType, rowCount } of ordered) {
      try {
        const zipEntry = zip.getEntries().find(
          (e) => !e.isDirectory && (e.entryName.endsWith(filename) || e.entryName.split('/').pop() === filename),
        );
        if (!zipEntry) {
          errors.push(`${filename}: file not found in pack`);
          continue;
        }
        const content = zipEntry.getData();

        const job = await this.dataImportsService.uploadAndParse(
          datasetType,
          filename,
          content as Buffer,
          userId,
        );

        const validationResult = await this.dataImportsService.validateJob(
          (job as { id: string }).id,
          userId,
        );

        const summaryJson = validationResult as unknown as {
          total_rows?: number;
          valid_rows?: number;
          errors?: number;
        };
        if ((summaryJson.errors ?? 0) > 0) {
          errors.push(
            `${filename}: validation failed with ${summaryJson.errors} errors`,
          );
          summary[datasetType] = {
            total_rows: summaryJson.total_rows,
            errors: summaryJson.errors,
          };
          continue;
        }

        await this.dataImportsService.approveJob(
          (job as { id: string }).id,
          userId,
        );

        const publishResult = await this.dataImportsService.publishJob(
          (job as { id: string }).id,
          userId,
        );

        const pub = publishResult as { publishSummaryJson?: { created?: number; updated?: number } };
        const ps = pub?.publishSummaryJson ?? {};
        const created = ps.created ?? 0;
        const updated = ps.updated ?? 0;
        summary[datasetType] = {
          created,
          updated,
          total_rows: rowCount,
        };
        const key = datasetType.toLowerCase() as keyof PackReportSummary;
        if (created > 0) (reportSummary as Record<string, number>)[`${key}_created`] = created;
        if (updated > 0) (reportSummary as Record<string, number>)[`${key}_updated`] = updated;
        const label = datasetType.replace(/_/g, ' ');
        if (created > 0 && updated > 0) {
          report.push(`${label}: ${created} created, ${updated} updated`);
        } else if (created > 0) {
          report.push(`${label}: ${created} created`);
        } else if (updated > 0) {
          report.push(`${label}: ${updated} updated`);
        } else {
          report.push(`${label}: ${rowCount} processed`);
        }

        this.logger.log(
          `Bootstrap pack: ${datasetType} imported - ${created} created, ${updated} updated`,
        );
      } catch (e) {
        const msg = (e as Error).message;
        errors.push(`${filename} (${datasetType}): ${msg}`);
        summary[datasetType] = { errors: 1 };
        this.logger.error(`Bootstrap pack import failed for ${datasetType}: ${msg}`);
      }
    }

    if (report.length > 0) {
      report.unshift('--- Bootstrap Pack Import Summary ---');
      if (warnings.length > 0) {
        report.push('', 'Warnings:', ...warnings.map((w) => `• ${w}`));
      }
    } else if (errors.length > 0) {
      report.push('--- Bootstrap Pack Import ---', 'Import failed.', '', ...errors.map((e) => `• ${e}`));
    }

    let hierarchyValidation: HierarchyIntegrityReport | undefined;
    const hadEmployees = ordered.some(
      (f) => f.datasetType === 'EMPLOYEES' || f.datasetType === 'MANAGER_RELATIONSHIPS',
    );
    if (hadEmployees) {
      try {
        this.logger.log('Running post-import hierarchy validation...');
        hierarchyValidation = await this.hierarchyIntegrity.getReport();

        report.push('');
        report.push('--- Manager Hierarchy Validation ---');
        report.push(`Employees total: ${hierarchyValidation.employees_total}`);
        report.push(`Managers assigned: ${hierarchyValidation.manager_assigned}`);
        report.push(`Missing managers: ${hierarchyValidation.missing_manager}`);
        report.push(`Cycles detected: ${hierarchyValidation.cycles_detected}`);
        report.push(`Self-managers: ${hierarchyValidation.self_manager}`);
        report.push(`Orphan managers: ${hierarchyValidation.orphan_managers}`);
        report.push(`Cross-entity managers: ${hierarchyValidation.cross_entity_managers}`);
        report.push(`Cross-org managers: ${hierarchyValidation.cross_org_managers}`);
        report.push(`Max hierarchy depth: ${hierarchyValidation.max_depth}`);
        report.push(`Largest span of control: ${hierarchyValidation.largest_span}`);
        report.push(`Status: ${hierarchyValidation.status}`);

        if (hierarchyValidation.errors.length > 0) {
          report.push('', 'Errors:');
          for (const e of hierarchyValidation.errors) {
            report.push(`  • [${e.code}] ${e.message}`);
          }
        }
        if (hierarchyValidation.warnings.length > 0) {
          report.push('', 'Warnings:');
          for (const w of hierarchyValidation.warnings) {
            report.push(`  • [${w.code}] ${w.message}`);
          }
        }

        this.logger.log(`Hierarchy validation: ${hierarchyValidation.status}`);
      } catch (e) {
        this.logger.error(`Hierarchy validation failed: ${(e as Error).message}`);
        report.push('', '--- Manager Hierarchy Validation ---', 'Validation failed (non-blocking).');
      }
    } else {
      report.push('');
      report.push('--- Manager Hierarchy Validation ---');
      report.push('Skipped — no EMPLOYEES or MANAGER_RELATIONSHIPS datasets in pack.');
    }

    return {
      success: errors.length === 0,
      summary,
      warnings,
      errors,
      report,
      reportSummary,
      manager_hierarchy_validation: hierarchyValidation,
    };
  }

  private sortByDependency(
    files: PackParseResult['files'],
  ): PackParseResult['files'] {
    const order = [...PACK_DATASET_ORDER];
    return files.sort((a, b) => {
      const ai = order.indexOf(a.datasetType as (typeof order)[number]);
      const bi = order.indexOf(b.datasetType as (typeof order)[number]);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
}
