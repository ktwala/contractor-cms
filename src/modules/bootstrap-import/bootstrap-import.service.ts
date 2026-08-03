import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataImportDatasetType, Prisma } from '@prisma/client';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../core/database/prisma.service';
import { DataImportsService } from '../data-imports/data-imports.service';
import { HierarchyIntegrityService } from '../hierarchy/hierarchy-integrity.service';
import { BootstrapPackParser, ParsedPack } from './bootstrap-pack.parser';
import {
  DATASET_ORDER,
  BootstrapUploadResult,
  BootstrapRunResult,
  DatasetImportResult,
} from './bootstrap-import.types';

@Injectable()
export class BootstrapImportService {
  private readonly logger = new Logger(BootstrapImportService.name);

  private parsedCache = new Map<string, ParsedPack>();
  private runningImport: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: BootstrapPackParser,
    private readonly dataImportsService: DataImportsService,
    private readonly hierarchyIntegrity: HierarchyIntegrityService,
  ) {}

  async upload(buffer: Buffer, fileName: string, userId: string): Promise<BootstrapUploadResult> {
    const parsed = this.parser.parse(buffer, fileName);

    if (parsed.datasets.size === 0) {
      throw new BadRequestException(
        'No valid datasets found. Ensure your workbook has sheets named LegalEntities, Employees, etc., or your ZIP contains correctly named CSV files.',
      );
    }

    const { datasets, blocked, missingRequired } = this.parser.buildDetectedDatasets(parsed);

    const rowCounts: Record<string, number> = {};
    for (const ds of datasets) {
      rowCounts[ds.datasetType.toLowerCase()] = ds.rowCount;
    }

    const bootstrapImport = await this.prisma.bootstrapImport.create({
      data: {
        fileName,
        fileType: parsed.fileType,
        status: 'DETECTED',
        createdBy: userId,
        datasetsJson: datasets as any,
      },
    });

    this.parsedCache.set(bootstrapImport.id, parsed);

    return {
      bootstrap_import_id: bootstrapImport.id,
      file_type: parsed.fileType,
      datasets_detected: datasets.map((d) => d.datasetType.toLowerCase()),
      datasets,
      row_counts: rowCounts,
      warnings: parsed.warnings,
      missing_required: missingRequired,
      blocked,
    };
  }

  /**
   * Enqueue the bootstrap import for background processing.
   * Returns immediately so the API doesn't block. The @Interval worker
   * picks up IMPORTING jobs and processes datasets sequentially.
   */
  async run(importId: string, userId: string): Promise<{ bootstrap_import_id: string; status: string }> {
    const bi = await this.prisma.bootstrapImport.findUnique({ where: { id: importId } });
    if (!bi) throw new NotFoundException('Bootstrap import not found');

    const parsed = this.parsedCache.get(importId);
    if (!parsed) {
      throw new BadRequestException('Parsed data expired. Please re-upload the file.');
    }

    await this.prisma.bootstrapImportJob.deleteMany({ where: { bootstrapImportId: importId } });

    const orderedTypes = DATASET_ORDER.filter((dt) => parsed.datasets.has(dt));
    let order = 0;
    for (const datasetType of orderedTypes) {
      const entry = parsed.datasets.get(datasetType)!;
      order++;
      await this.prisma.bootstrapImportJob.create({
        data: {
          bootstrapImportId: importId,
          datasetType,
          executionOrder: order,
          status: 'PENDING',
          resultJson: { rows: entry.rows.length } as any,
        },
      });
    }

    await this.prisma.bootstrapImport.update({
      where: { id: importId },
      data: {
        status: 'IMPORTING',
        summaryJson: {
          user_id: userId,
          datasets_total: orderedTypes.length,
          datasets_processed: 0,
          current_dataset: null,
        } as any,
      },
    });

    this.logger.log(`Bootstrap import ${importId} enqueued with ${orderedTypes.length} datasets`);
    return { bootstrap_import_id: importId, status: 'IMPORTING' };
  }

  // ─── Background worker ────────────────────────────────────────

  @Interval(3000)
  async processBootstrapQueue() {
    if (this.runningImport) return;
    const bi = await this.prisma.bootstrapImport.findFirst({
      where: { status: 'IMPORTING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!bi) return;

    this.runningImport = bi.id;
    try {
      await this.executeImport(bi.id);
    } catch (err) {
      this.logger.error(`Bootstrap pipeline error for ${bi.id}: ${(err as Error).message}`);
      await this.prisma.bootstrapImport.update({
        where: { id: bi.id },
        data: {
          status: 'FAILED',
          summaryJson: { error: (err as Error).message } as any,
        },
      });
    } finally {
      this.parsedCache.delete(bi.id);
      this.runningImport = null;
    }
  }

  private async executeImport(importId: string) {
    const bi = await this.prisma.bootstrapImport.findUnique({ where: { id: importId } });
    if (!bi) return;

    const parsed = this.parsedCache.get(importId);
    if (!parsed) {
      await this.prisma.bootstrapImport.update({
        where: { id: importId },
        data: { status: 'FAILED', summaryJson: { error: 'Parsed data expired. Please re-upload.' } as any },
      });
      return;
    }

    const summaryMeta = (bi.summaryJson as Record<string, unknown>) ?? {};
    const userId = (summaryMeta.user_id as string) ?? 'system';

    const pendingJobs = await this.prisma.bootstrapImportJob.findMany({
      where: { bootstrapImportId: importId, status: 'PENDING' },
      orderBy: { executionOrder: 'asc' },
    });

    const results: DatasetImportResult[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const report: string[] = ['--- Bootstrap Organisation Import Summary ---'];
    let datasetsProcessed = 0;

    for (const biJob of pendingJobs) {
      const currentBi = await this.prisma.bootstrapImport.findUnique({
        where: { id: importId },
        select: { status: true },
      });
      if (currentBi?.status === 'CANCELLING') {
        const now = new Date();
        await this.prisma.bootstrapImport.update({
          where: { id: importId },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            finishedAt: now,
            finalSummaryJson: {
              final_status: 'CANCELLED',
              reason: 'Cancelled between dataset stages',
              datasets_completed: datasetsProcessed,
              datasets_remaining: pendingJobs.length - datasetsProcessed,
              cancelled_at: now.toISOString(),
            } as any,
          },
        });
        for (const remaining of pendingJobs.slice(pendingJobs.indexOf(biJob))) {
          if (remaining.status === 'PENDING') {
            await this.prisma.bootstrapImportJob.update({
              where: { id: remaining.id },
              data: { status: 'CANCELLED' },
            });
          }
        }
        this.logger.log(`Bootstrap import ${importId}: cancelled between stages`);
        return;
      }

      const datasetType = biJob.datasetType as DataImportDatasetType;
      const entry = parsed.datasets.get(datasetType);
      if (!entry) continue;

      const label = datasetType.replace(/_/g, ' ');
      datasetsProcessed++;

      await this.prisma.bootstrapImport.update({
        where: { id: importId },
        data: {
          summaryJson: {
            ...summaryMeta,
            datasets_processed: datasetsProcessed - 1,
            current_dataset: datasetType.toLowerCase(),
          } as any,
        },
      });

      await this.prisma.bootstrapImportJob.update({
        where: { id: biJob.id },
        data: { status: 'VALIDATING' },
      });

      try {
        const csvBuffer = this.rowsToCsvBuffer(entry.rows);
        const job = await this.dataImportsService.uploadAndParse(
          datasetType,
          `${datasetType.toLowerCase()}.csv`,
          csvBuffer,
          userId,
        );

        const jobId = (job as { id: string }).id;

        await this.prisma.bootstrapImportJob.update({
          where: { id: biJob.id },
          data: { dataImportJobId: jobId },
        });

        const validationResult = await this.dataImportsService.validateJob(jobId, userId);
        const summary = validationResult as unknown as {
          total_rows?: number;
          valid_rows?: number;
          errors?: number;
          warnings?: number;
        };

        const errCount = summary.errors ?? 0;
        const warnCount = summary.warnings ?? 0;

        if (warnCount > 0) {
          warnings.push(`${label}: ${warnCount} validation warning(s)`);
        }

        if (errCount > 0) {
          errors.push(`${label}: ${errCount} validation error(s) — skipped`);
          results.push({
            dataset: datasetType.toLowerCase(),
            created: 0, updated: 0, skipped: entry.rows.length, errors: errCount,
          });

          await this.prisma.bootstrapImportJob.update({
            where: { id: biJob.id },
            data: { status: 'HAS_ERRORS', resultJson: summary as any },
          });

          report.push(`${label}: FAILED (${errCount} errors)`);
          continue;
        }

        await this.prisma.bootstrapImportJob.update({
          where: { id: biJob.id },
          data: { status: 'PUBLISHING' },
        });

        await this.dataImportsService.approveJob(jobId, userId);
        const publishResult = await this.dataImportsService.publishJob(jobId, userId);

        const pub = publishResult as { publishSummaryJson?: { created?: number; updated?: number; skipped?: number } };
        const ps = pub?.publishSummaryJson ?? {};
        const created = ps.created ?? 0;
        const updated = ps.updated ?? 0;
        const skipped = ps.skipped ?? 0;

        results.push({
          dataset: datasetType.toLowerCase(),
          created, updated, skipped, errors: 0,
        });

        await this.prisma.bootstrapImportJob.update({
          where: { id: biJob.id },
          data: { status: 'PUBLISHED', resultJson: { created, updated, skipped } as any },
        });

        const parts: string[] = [];
        if (created > 0) parts.push(`${created} created`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (skipped > 0) parts.push(`${skipped} skipped`);
        report.push(`${label}: ${parts.length > 0 ? parts.join(', ') : 'processed'}`);
      } catch (e) {
        const msg = (e as Error).message;
        errors.push(`${label}: ${msg}`);
        results.push({
          dataset: datasetType.toLowerCase(),
          created: 0, updated: 0, skipped: 0, errors: 1,
        });
        await this.prisma.bootstrapImportJob.update({
          where: { id: biJob.id },
          data: { status: 'FAILED', resultJson: { error: msg } as any },
        });
        this.logger.error(`Import failed for ${datasetType}: ${msg}`);
      }
    }

    const orderedTypes = pendingJobs.map((j) => j.datasetType as DataImportDatasetType);
    const hadEmployees = orderedTypes.some(
      (dt) => dt === 'EMPLOYEES' || dt === 'MANAGER_RELATIONSHIPS',
    );
    if (hadEmployees) {
      try {
        const hierarchyReport = await this.hierarchyIntegrity.getReport();
        report.push('');
        report.push('--- Manager Hierarchy Validation ---');
        report.push(`Managers assigned: ${hierarchyReport.manager_assigned}/${hierarchyReport.employees_total}`);
        report.push(`Missing managers: ${hierarchyReport.missing_manager}`);
        if (hierarchyReport.cycles_detected > 0) report.push(`Cycles detected: ${hierarchyReport.cycles_detected}`);
        report.push(`Status: ${hierarchyReport.status}`);

        if (hierarchyReport.missing_manager > 0) {
          warnings.push(`${hierarchyReport.missing_manager} employees have no manager assigned`);
        }
      } catch {
        report.push('', 'Hierarchy validation: skipped (non-blocking error)');
      }
    }

    if (warnings.length > 0) {
      report.push('', 'Warnings:');
      for (const w of warnings) report.push(`  • ${w}`);
    }
    if (errors.length > 0) {
      report.push('', 'Errors:');
      for (const e of errors) report.push(`  • ${e}`);
    }

    const finalStatus = errors.length > 0
      ? 'FAILED'
      : warnings.length > 0
        ? 'COMPLETED_WITH_WARNINGS'
        : 'COMPLETED';

    const now = new Date();
    const totalRows = results.reduce((sum, r) => sum + r.created + r.updated + r.skipped + r.errors, 0);
    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    await this.prisma.bootstrapImport.update({
      where: { id: importId },
      data: {
        status: errors.length > 0 ? 'FAILED' : 'COMPLETED',
        finishedAt: now,
        summaryJson: {
          results,
          warnings,
          errors,
          report,
          datasets_total: pendingJobs.length,
          datasets_processed: datasetsProcessed,
        } as any,
        finalSummaryJson: {
          final_status: finalStatus,
          finished_at: now.toISOString(),
          datasets_total: pendingJobs.length,
          datasets_processed: datasetsProcessed,
          total_rows: totalRows,
          total_created: totalCreated,
          total_updated: totalUpdated,
          total_skipped: totalSkipped,
          total_errors: totalErrors,
          warnings_count: warnings.length,
          errors_count: errors.length,
        } as any,
      },
    });

    this.logger.log(`Bootstrap import ${importId} completed: ${finalStatus}`);
  }

  // ─── Cancel ───────────────────────────────────────────────────

  async cancelImport(importId: string, userId: string, reason?: string) {
    const bi = await this.prisma.bootstrapImport.findUnique({ where: { id: importId } });
    if (!bi) throw new NotFoundException('Bootstrap import not found');

    const cancellable = ['DETECTED', 'IMPORTING'];
    if (!cancellable.includes(bi.status)) {
      throw new BadRequestException(`Cannot cancel import in ${bi.status} status`);
    }

    if (bi.status === 'IMPORTING') {
      await this.prisma.bootstrapImport.update({
        where: { id: importId, status: 'IMPORTING' },
        data: {
          status: 'CANCELLING',
          cancelledByUserId: userId,
          cancelReason: reason ?? 'Cancelled by user',
        },
      });
      this.logger.log(`Bootstrap import ${importId}: cancellation requested`);
    } else {
      const now = new Date();
      await this.prisma.bootstrapImport.update({
        where: { id: importId },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledByUserId: userId,
          cancelReason: reason ?? 'Cancelled by user',
          finishedAt: now,
          finalSummaryJson: { final_status: 'CANCELLED', reason: reason ?? 'Cancelled by user', cancelled_at: now.toISOString() } as any,
        },
      });
      this.parsedCache.delete(importId);
      this.logger.log(`Bootstrap import ${importId}: cancelled immediately`);
    }

    return this.getById(importId);
  }

  // ─── Retry from failed stage ──────────────────────────────────

  async retryImport(importId: string, userId: string) {
    const bi = await this.prisma.bootstrapImport.findUnique({
      where: { id: importId },
      include: { jobs: { orderBy: { executionOrder: 'asc' } } },
    });
    if (!bi) throw new NotFoundException('Bootstrap import not found');

    if (!['FAILED', 'CANCELLED'].includes(bi.status)) {
      throw new BadRequestException(`Cannot retry import in ${bi.status} status`);
    }

    const parsed = this.parsedCache.get(importId);
    if (!parsed) {
      throw new BadRequestException('Parsed data expired. Please re-upload the file and start a new import.');
    }

    const failedJobs = bi.jobs.filter((j) => ['FAILED', 'HAS_ERRORS', 'PENDING', 'CANCELLED'].includes(j.status));
    if (failedJobs.length === 0) {
      throw new BadRequestException('No failed datasets to retry');
    }

    for (const job of failedJobs) {
      await this.prisma.bootstrapImportJob.update({
        where: { id: job.id },
        data: { status: 'PENDING', resultJson: Prisma.DbNull, dataImportJobId: null },
      });
    }

    await this.prisma.bootstrapImport.update({
      where: { id: importId },
      data: {
        status: 'IMPORTING',
        cancelledAt: null,
        cancelReason: null,
        finishedAt: null,
        summaryJson: {
          user_id: userId,
          datasets_total: bi.jobs.length,
          datasets_processed: bi.jobs.length - failedJobs.length,
          current_dataset: null,
          retry: true,
          retried_datasets: failedJobs.map((j) => j.datasetType),
        } as any,
      },
    });

    this.logger.log(`Bootstrap import ${importId}: retrying ${failedJobs.length} failed datasets`);
    return { bootstrap_import_id: importId, status: 'IMPORTING', retrying: failedJobs.map((j) => j.datasetType) };
  }

  async getById(importId: string) {
    const bi = await this.prisma.bootstrapImport.findUnique({
      where: { id: importId },
      include: { jobs: { orderBy: { executionOrder: 'asc' } } },
    });
    if (!bi) throw new NotFoundException('Bootstrap import not found');

    return {
      bootstrap_import_id: bi.id,
      file_name: bi.fileName,
      file_type: bi.fileType,
      status: bi.status,
      created_at: bi.createdAt,
      finished_at: bi.finishedAt,
      cancelled_at: bi.cancelledAt,
      cancel_reason: bi.cancelReason,
      datasets: bi.datasetsJson,
      summary: bi.summaryJson,
      final_summary: bi.finalSummaryJson,
      jobs: bi.jobs.map((j) => ({
        id: j.id,
        dataset_type: j.datasetType,
        data_import_job_id: j.dataImportJobId,
        execution_order: j.executionOrder,
        status: j.status,
        result: j.resultJson,
      })),
    };
  }

  generateWorkbookTemplate(): Buffer {
    const wb = XLSX.utils.book_new();

    const instructions = [
      ['Hubsec Workforce Onboarding Template'],
      [''],
      ['Instructions:'],
      ['1. Fill in each sheet with your organisation data.'],
      ['2. Do not rename the sheets — the system uses sheet names to detect datasets.'],
      ['3. Do not change the column headers in each sheet.'],
      ['4. Required sheets: LegalEntities, Employees, Employments.'],
      ['5. Optional sheets: PayGroups, OrgUnits, CostCenters, Positions, Assignments, Managers.'],
      ['6. Save the file and upload it on the Bootstrap Organisation page.'],
      [''],
      ['Sheet reference:'],
      ['  LegalEntities  → Legal entities / companies'],
      ['  PayGroups       → Pay groups / payroll calendars'],
      ['  OrgUnits        → Organisational units / departments'],
      ['  CostCenters     → Cost centers'],
      ['  Positions       → Job positions'],
      ['  Employees       → Employee master data'],
      ['  Employments     → Employment contracts / assignments to legal entities'],
      ['  Assignments     → Employment assignments to org units / cost centers'],
      ['  Managers        → Manager-employee reporting relationships'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');

    const sheets: Record<string, string[]> = {
      LegalEntities: ['code', 'name', 'registration_number', 'tax_number', 'country', 'address'],
      PayGroups: ['code', 'name', 'legal_entity_code', 'country', 'currency', 'frequency'],
      OrgUnits: ['code', 'name', 'legal_entity_code', 'parent_org_unit_code'],
      CostCenters: ['code', 'name', 'legal_entity_code'],
      Positions: ['code', 'title', 'org_unit_code', 'grade', 'headcount'],
      Employees: ['employee_no', 'first_name', 'last_name', 'email', 'national_id', 'date_of_birth', 'hire_date', 'status', 'job_title', 'department', 'legal_entity_code', 'country'],
      Employments: ['employee_no', 'legal_entity_code', 'pay_group_code', 'job_title', 'employment_type', 'effective_from', 'effective_to', 'country'],
      Assignments: ['employee_no', 'legal_entity_code', 'org_unit_code', 'cost_center_code', 'position_code', 'effective_from', 'effective_to'],
      Managers: ['employee_no', 'manager_employee_no'],
    };

    for (const [sheetName, headers] of Object.entries(sheets)) {
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      ws['!cols'] = headers.map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer);
  }

  private rowsToCsvBuffer(rows: Record<string, unknown>[]): Buffer {
    if (rows.length === 0) return Buffer.from('');
    const headers = Object.keys(rows[0]);
    const csv = Papa.unparse({
      fields: headers,
      data: rows.map((r) => headers.map((h) => r[h] ?? '')),
    });
    return Buffer.from(csv, 'utf-8');
  }
}
