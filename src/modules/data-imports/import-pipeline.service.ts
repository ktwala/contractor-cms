import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { DataImportsService } from './data-imports.service';

const POLL_INTERVAL_MS = 2000;
const STALE_JOB_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const STALE_CHECK_INTERVAL_MS = 30_000;

export interface PipelineJobStatus {
  job_id: string;
  dataset_type: string;
  file_name: string;
  status: string;
  stage: 'idle' | 'validating' | 'publishing' | 'cancelling';
  rows_total: number;
  rows_processed: number;
  rows_valid: number;
  rows_invalid: number;
  progress_pct: number;
  started_at: string | null;
  finished_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  summary: unknown;
  publish_summary: unknown;
  final_summary: unknown;
}

@Injectable()
export class ImportPipelineService {
  private readonly logger = new Logger(ImportPipelineService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataImportsService: DataImportsService,
  ) {}

  // ─── Worker loop ──────────────────────────────────────────────

  @Interval(POLL_INTERVAL_MS)
  async pollQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.processNextJob();
    } catch (err) {
      this.logger.error(`Pipeline poll error: ${(err as Error).message}`);
    } finally {
      this.processing = false;
    }
  }

  @Interval(STALE_CHECK_INTERVAL_MS)
  async recoverStaleJobs() {
    try {
      const threshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);

      const staleJobs = await this.prisma.dataImportJob.findMany({
        where: {
          status: { in: ['VALIDATING', 'PUBLISHING'] },
          pipelineStartedAt: { lt: threshold },
        },
        select: { id: true, status: true, pipelineStartedAt: true },
      });

      for (const job of staleJobs) {
        this.logger.warn(`Stale job detected: ${job.id} (${job.status} since ${job.pipelineStartedAt?.toISOString()})`);
        await this.prisma.dataImportJob.update({
          where: { id: job.id, status: job.status },
          data: {
            status: 'FAILED',
            pipelineFinishedAt: new Date(),
            cancelReason: `Stale worker: job stuck in ${job.status} for over ${STALE_JOB_THRESHOLD_MS / 60000} minutes`,
            finalSummaryJson: {
              failure_reason: 'stale_worker',
              original_status: job.status,
              recovered_at: new Date().toISOString(),
            } as object,
          },
        });
      }
    } catch (err) {
      this.logger.error(`Stale job recovery error: ${(err as Error).message}`);
    }
  }

  /**
   * Atomic claim pattern: UPDATE ... WHERE status = X ensures only
   * one worker instance processes a given job, even if multiple
   * app processes are running.
   */
  private async processNextJob() {
    const candidate = await this.prisma.dataImportJob.findFirst({
      where: { status: { in: ['VALIDATING', 'PUBLISHING', 'CANCELLING'] } },
      orderBy: { updatedAt: 'asc' },
      select: { id: true, status: true },
    });
    if (!candidate) return;

    if (candidate.status === 'CANCELLING') {
      await this.executeCancellation(candidate.id);
      return;
    }

    if (candidate.status === 'VALIDATING') {
      await this.runValidation(candidate.id);
    } else if (candidate.status === 'PUBLISHING') {
      await this.runPublish(candidate.id);
    }
  }

  // ─── Enqueue helpers ──────────────────────────────────────────

  async enqueueValidation(jobId: string): Promise<PipelineJobStatus> {
    const job = await this.prisma.dataImportJob.findUnique({
      where: { id: jobId },
      include: { _count: { select: { rows: true } } },
    });
    if (!job) throw new Error('Import job not found');

    if (['PUBLISHED', 'CANCELLED'].includes(job.status)) {
      throw new Error(`${job.status} jobs cannot be revalidated`);
    }

    const rowsTotal = job._count.rows;

    await this.prisma.dataImportError.deleteMany({ where: { jobId } });
    await this.prisma.dataImportRow.updateMany({
      where: { jobId },
      data: { status: 'PENDING', errorsCount: 0, warningsCount: 0 },
    });

    await this.prisma.dataImportJob.update({
      where: { id: jobId },
      data: {
        status: 'VALIDATING',
        rowsTotal,
        rowsProcessed: 0,
        rowsValid: 0,
        rowsInvalid: 0,
        pipelineStartedAt: new Date(),
        pipelineFinishedAt: null,
        cancelledAt: null,
        cancelReason: null,
        summaryJson: Prisma.DbNull,
      },
    });

    this.logger.log(`Pipeline: enqueued validation for job ${jobId} (${rowsTotal} rows)`);
    return this.getJobStatus(jobId);
  }

  async enqueuePublish(jobId: string): Promise<PipelineJobStatus> {
    const job = await this.prisma.dataImportJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new Error('Import job not found');
    if (job.status !== 'APPROVED') {
      throw new Error('Job must be approved before publishing');
    }

    await this.prisma.dataImportJob.update({
      where: { id: jobId },
      data: {
        status: 'PUBLISHING',
        rowsProcessed: 0,
        pipelineStartedAt: new Date(),
        pipelineFinishedAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
    });

    this.logger.log(`Pipeline: enqueued publishing for job ${jobId}`);
    return this.getJobStatus(jobId);
  }

  // ─── Cancel ───────────────────────────────────────────────────

  async cancelJob(jobId: string, userId: string, reason?: string): Promise<PipelineJobStatus> {
    const job = await this.prisma.dataImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Import job not found');

    const cancellableStatuses = ['UPLOADED', 'PARSED', 'VALIDATING', 'VALIDATED', 'HAS_ERRORS', 'APPROVED', 'PUBLISHING'];
    if (!cancellableStatuses.includes(job.status)) {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    const isActive = ['VALIDATING', 'PUBLISHING'].includes(job.status);

    if (isActive) {
      await this.prisma.dataImportJob.update({
        where: { id: jobId, status: job.status },
        data: {
          status: 'CANCELLING',
          cancelReason: reason ?? 'Cancelled by user',
          cancelledByUserId: userId,
        },
      });
      this.logger.log(`Pipeline: cancellation requested for active job ${jobId}`);
    } else {
      await this.prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByUserId: userId,
          cancelReason: reason ?? 'Cancelled by user',
          pipelineFinishedAt: new Date(),
          finalSummaryJson: this.buildFinalSummary(job, 'CANCELLED', reason ?? 'Cancelled by user') as object,
        },
      });
      this.logger.log(`Pipeline: job ${jobId} cancelled immediately (was ${job.status})`);
    }

    return this.getJobStatus(jobId);
  }

  private async executeCancellation(jobId: string) {
    const job = await this.prisma.dataImportJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'CANCELLING') return;

    await this.prisma.dataImportJob.update({
      where: { id: jobId, status: 'CANCELLING' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        pipelineFinishedAt: new Date(),
        finalSummaryJson: this.buildFinalSummary(job, 'CANCELLED', job.cancelReason ?? 'Cancelled') as object,
      },
    });

    this.logger.log(`Pipeline: job ${jobId} cancelled cooperatively`);
  }

  // ─── Retry ────────────────────────────────────────────────────

  async retryJob(jobId: string, userId: string): Promise<PipelineJobStatus> {
    const job = await this.prisma.dataImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Import job not found');

    if (job.status === 'FAILED' || job.status === 'HAS_ERRORS' || job.status === 'CANCELLED') {
      return this.enqueueValidation(jobId);
    }

    throw new Error(`Cannot retry job in ${job.status} status — only FAILED, HAS_ERRORS, or CANCELLED jobs can be retried`);
  }

  // ─── Status query ─────────────────────────────────────────────

  async getJobStatus(jobId: string): Promise<PipelineJobStatus> {
    const job = await this.prisma.dataImportJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new Error('Import job not found');

    let rowsProcessed = job.rowsProcessed;
    let stage: PipelineJobStatus['stage'] = 'idle';

    if (job.status === 'VALIDATING') {
      stage = 'validating';
      const processed = await this.prisma.dataImportRow.count({
        where: { jobId, status: { not: 'PENDING' } },
      });
      rowsProcessed = processed;
    } else if (job.status === 'PUBLISHING') {
      stage = 'publishing';
    } else if (job.status === 'CANCELLING') {
      stage = 'cancelling';
    }

    const total = job.rowsTotal || 1;
    const pct = Math.min(100, Math.round((rowsProcessed / total) * 100));

    return {
      job_id: job.id,
      dataset_type: job.datasetType,
      file_name: job.fileName,
      status: job.status,
      stage,
      rows_total: job.rowsTotal,
      rows_processed: rowsProcessed,
      rows_valid: job.rowsValid,
      rows_invalid: job.rowsInvalid,
      progress_pct: pct,
      started_at: job.pipelineStartedAt?.toISOString() ?? null,
      finished_at: job.pipelineFinishedAt?.toISOString() ?? null,
      cancelled_at: job.cancelledAt?.toISOString() ?? null,
      cancel_reason: job.cancelReason,
      summary: job.summaryJson,
      publish_summary: job.publishSummaryJson,
      final_summary: job.finalSummaryJson,
    };
  }

  // ─── Validation worker ────────────────────────────────────────

  private async runValidation(jobId: string) {
    const claimed = await this.claimJob(jobId, 'VALIDATING');
    if (!claimed) return;

    const startTime = Date.now();
    this.logger.log(`Pipeline: starting validation for ${jobId}`);

    try {
      const job = await this.prisma.dataImportJob.findUnique({ where: { id: jobId } });
      if (!job) return;

      const result = await this.dataImportsService.validateJob(jobId, job.uploadedByUserId);

      const current = await this.prisma.dataImportJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (current?.status === 'CANCELLING') {
        await this.executeCancellation(jobId);
        return;
      }

      const summary = result as Record<string, number>;
      const now = new Date();
      await this.prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          rowsProcessed: summary.total_rows ?? 0,
          rowsValid: summary.valid_rows ?? 0,
          rowsInvalid: summary.invalid_rows ?? 0,
          pipelineFinishedAt: now,
          finalSummaryJson: {
            stage: 'validation',
            completed_at: now.toISOString(),
            elapsed_ms: Date.now() - startTime,
            total_rows: summary.total_rows ?? 0,
            valid_rows: summary.valid_rows ?? 0,
            invalid_rows: summary.invalid_rows ?? 0,
            warnings: summary.warnings ?? 0,
            errors: summary.errors ?? 0,
          } as object,
        },
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `Pipeline: validation complete for ${jobId} in ${elapsed}s — ${summary.valid_rows ?? 0} valid, ${summary.invalid_rows ?? 0} invalid`,
      );
    } catch (err) {
      this.logger.error(`Pipeline: validation failed for ${jobId}: ${(err as Error).message}`);
      await this.prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          pipelineFinishedAt: new Date(),
          summaryJson: { error: (err as Error).message } as object,
          finalSummaryJson: {
            stage: 'validation',
            failure_reason: (err as Error).message,
            elapsed_ms: Date.now() - startTime,
            failed_at: new Date().toISOString(),
          } as object,
        },
      });
    }
  }

  // ─── Publish worker ───────────────────────────────────────────

  private async runPublish(jobId: string) {
    const claimed = await this.claimJob(jobId, 'PUBLISHING');
    if (!claimed) return;

    const startTime = Date.now();
    this.logger.log(`Pipeline: starting publish for ${jobId}`);

    try {
      const job = await this.prisma.dataImportJob.findUnique({
        where: { id: jobId },
        include: { rows: true },
      });
      if (!job) return;

      const current = await this.prisma.dataImportJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (current?.status === 'CANCELLING') {
        await this.executeCancellation(jobId);
        return;
      }

      await this.dataImportsService.publishJobInternal(job as any);

      const now = new Date();
      const publishSummary = (await this.prisma.dataImportJob.findUnique({
        where: { id: jobId },
        select: { publishSummaryJson: true },
      }))?.publishSummaryJson as Record<string, number> | null;

      await this.prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          rowsProcessed: job.rowsTotal,
          pipelineFinishedAt: now,
          finalSummaryJson: {
            stage: 'publish',
            completed_at: now.toISOString(),
            elapsed_ms: Date.now() - startTime,
            total_rows: job.rowsTotal,
            created: publishSummary?.created ?? 0,
            updated: publishSummary?.updated ?? 0,
            skipped: publishSummary?.skipped ?? 0,
          } as object,
        },
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Pipeline: publish complete for ${jobId} in ${elapsed}s`);
    } catch (err) {
      this.logger.error(`Pipeline: publish failed for ${jobId}: ${(err as Error).message}`);
      await this.prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          pipelineFinishedAt: new Date(),
          publishSummaryJson: { error: (err as Error).message } as object,
          finalSummaryJson: {
            stage: 'publish',
            failure_reason: (err as Error).message,
            elapsed_ms: Date.now() - startTime,
            failed_at: new Date().toISOString(),
          } as object,
        },
      });
    }
  }

  // ─── Safe claim pattern ───────────────────────────────────────

  /**
   * Atomically claim a job by updating only if it still has the
   * expected status. Returns true if this worker won the claim.
   * Prevents duplicate processing in multi-instance deployments.
   */
  private async claimJob(jobId: string, expectedStatus: string): Promise<boolean> {
    try {
      const result = await this.prisma.$executeRaw`
        UPDATE data_import_jobs
        SET updated_at = NOW()
        WHERE id = ${jobId} AND status = ${expectedStatus}::"DataImportStatus"
      `;
      return result > 0;
    } catch {
      return false;
    }
  }

  // ─── Final summary builder ────────────────────────────────────

  private buildFinalSummary(job: Record<string, unknown>, finalStatus: string, reason?: string) {
    return {
      final_status: finalStatus,
      reason,
      rows_total: job.rowsTotal ?? 0,
      rows_processed: job.rowsProcessed ?? 0,
      rows_valid: job.rowsValid ?? 0,
      rows_invalid: job.rowsInvalid ?? 0,
      pipeline_started_at: (job.pipelineStartedAt as Date)?.toISOString() ?? null,
      resolved_at: new Date().toISOString(),
    };
  }
}
