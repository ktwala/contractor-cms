import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { RequestUser, assertHasLegalEntities } from './sars-scope';

interface SubmissionQueueItem {
  id: string;
  batch_id: string;
  document_type: string;
  document_id: string;
  status: string;
  priority: number;
  retry_count: number;
  error_message?: string;
}

export interface SubmissionBatch {
  batch_id: string;
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

@Injectable()
export class BulkSubmissionService {
  private readonly logger = new Logger(BulkSubmissionService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Queue IRP5 certificates for bulk submission (scoped to user's legal entities)
   */
  async queueIRP5Batch(
    taxPeriodId: string,
    queuedBy: string,
    user: RequestUser,
  ): Promise<{ batch_id: string; queued: number }> {
    const allowed = assertHasLegalEntities(user);
    const batchId = crypto.randomUUID();

    // Get IRP5 certificates for the period, scoped via IRP5Certificate.legalEntityId
    const certificates = await this.prisma.iRP5Certificate.findMany({
      where: {
        taxPeriodId,
        status: { not: 'cancelled' },
        legalEntityId: { in: allowed },
      },
      select: { id: true, legalEntityId: true },
    });

    let queued = 0;

    for (const cert of certificates) {
      await this.queueDocument(batchId, 'irp5', cert.id, cert.legalEntityId, queuedBy, 5);
      queued++;
    }

    return { batch_id: batchId, queued };
  }

  /**
   * Queue EMP201 returns for bulk submission (scoped to user's legal entities)
   */
  async queueEMP201Batch(
    taxYear: string,
    queuedBy: string,
    user: RequestUser,
  ): Promise<{ batch_id: string; queued: number }> {
    const allowed = assertHasLegalEntities(user);
    const batchId = crypto.randomUUID();

    // Get EMP201 returns for the tax year, scoped to user's legal entities
    const returns = await this.prisma.eMP201Return.findMany({
      where: {
        taxYear,
        legalEntityId: { in: allowed },
        status: { not: 'cancelled' },
      },
      select: { id: true, legalEntityId: true },
    });

    let queued = 0;

    for (const ret of returns) {
      await this.queueDocument(batchId, 'emp201', ret.id, ret.legalEntityId, queuedBy, 5);
      queued++;
    }

    return { batch_id: batchId, queued };
  }

  /**
   * Queue a document for submission
   */
  private async queueDocument(
    batchId: string,
    documentType: string,
    documentId: string,
    legalEntityId: string,
    queuedBy: string,
    priority: number = 5
  ) {
    await this.prisma.sarsSubmissionQueue.create({
      data: {
        batchId,
        documentType,
        documentId,
        legalEntityId,
        priority,
        status: 'queued',
        queuedBy,
      },
    });
  }

  /**
   * Process submission queue.
   * Requires user with legalEntityAccess—headless/cron must pass system identity with explicit scope.
   * When user is missing, returns without processing (no unscoped job).
   */
  async processQueue(
    batchId?: string,
    user?: RequestUser,
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (!user) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }
    const allowed = assertHasLegalEntities(user);
    const items = await this.prisma.sarsSubmissionQueue.findMany({
      where: {
        status: 'queued',
        retryCount: { lt: 3 },
        ...(batchId && { batchId }),
        legalEntityId: { in: allowed },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 50,
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        // Mark as processing
        await this.updateStatus(item.id, 'processing');

        // Simulate submission (in production, call actual SARS API)
        const result = await this.submitDocument(item.documentType, item.documentId);

        // Mark as completed
        await this.updateStatus(item.id, 'completed', result.sars_reference, result);

        processed++;
        succeeded++;
      } catch (error: any) {
        // Mark as failed
        await this.updateStatus(item.id, 'failed', null, null, error.message);

        processed++;
        failed++;
      }
    }

    return { processed, succeeded, failed };
  }

  /**
   * Simulate document submission (replace with actual SARS API call)
   */
  private async submitDocument(documentType: string, documentId: string): Promise<any> {
    // In production, this would call the SARS eFiling API
    // For now, simulate a successful submission

    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call

    return {
      sars_reference: `SARS${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`,
      submission_time: new Date(),
      status: 'accepted',
    };
  }

  /**
   * Update queue item status
   */
  private async updateStatus(
    itemId: string,
    status: string,
    sarsReference?: string | null,
    result?: any,
    errorMessage?: string
  ) {
    const data: any = { status };

    if (status === 'processing') {
      data.processingStartedAt = new Date();
    }

    if (status === 'completed') {
      data.processingCompletedAt = new Date();
      data.sarsReferenceNumber = sarsReference;
      data.submissionResult = result;
    }

    if (status === 'failed') {
      data.errorMessage = errorMessage;
      data.lastErrorAt = new Date();
      data.retryCount = { increment: 1 };
    }

    await this.prisma.sarsSubmissionQueue.update({
      where: { id: itemId },
      data,
    });
  }

  /**
   * Get batch status (scoped to user's legal entities).
   * When user is missing, returns empty stats—no unscoped data.
   */
  async getBatchStatus(batchId: string, user?: RequestUser): Promise<SubmissionBatch> {
    if (!user) {
      return { batch_id: batchId, total: 0, queued: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
    }
    const allowed = assertHasLegalEntities(user);
    const items = await this.prisma.sarsSubmissionQueue.findMany({
      where: { batchId, legalEntityId: { in: allowed } },
    });

    const stats = {
      total: items.length,
      queued: items.filter(i => i.status === 'queued').length,
      processing: items.filter(i => i.status === 'processing').length,
      completed: items.filter(i => i.status === 'completed').length,
      failed: items.filter(i => i.status === 'failed').length,
      cancelled: items.filter(i => i.status === 'cancelled').length,
    };

    return {
      batch_id: batchId,
      ...stats,
    };
  }

  /**
   * Retry failed submissions in a batch (scoped to user's legal entities).
   * When user is missing, retries nothing.
   */
  async retryFailedInBatch(batchId: string, user?: RequestUser): Promise<{ retried: number }> {
    if (!user) return { retried: 0 };
    const allowed = assertHasLegalEntities(user);
    const result = await this.prisma.sarsSubmissionQueue.updateMany({
      where: {
        batchId,
        status: 'failed',
        retryCount: { lt: 3 },
        legalEntityId: { in: allowed },
      },
      data: {
        status: 'queued',
        retryCount: { increment: 1 },
      },
    });

    return { retried: result.count };
  }

  /**
   * Cancel pending submissions in a batch (scoped to user's legal entities).
   * When user is missing, cancels nothing.
   */
  async cancelBatch(batchId: string, user?: RequestUser): Promise<{ cancelled: number }> {
    if (!user) return { cancelled: 0 };
    const allowed = assertHasLegalEntities(user);
    const result = await this.prisma.sarsSubmissionQueue.updateMany({
      where: {
        batchId,
        status: { in: ['queued', 'failed'] },
        legalEntityId: { in: allowed },
      },
      data: { status: 'cancelled' },
    });

    return { cancelled: result.count };
  }

  /**
   * Get queue items for a batch (scoped to user's legal entities).
   * When user is missing, returns empty array.
   */
  async getBatchItems(batchId: string, user?: RequestUser) {
    if (!user) return [];
    const allowed = assertHasLegalEntities(user);
    return this.prisma.sarsSubmissionQueue.findMany({
      where: { batchId, legalEntityId: { in: allowed } },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Get all batches (scoped to user's legal entities when user provided)
   */
  async getAllBatches(limit: number = 50, user?: RequestUser) {
    // Get unique batch IDs with their first creation time
    const batches = await this.prisma.sarsSubmissionQueue.groupBy({
      by: ['batchId'],
      _min: { createdAt: true },
      orderBy: { _min: { createdAt: 'desc' } },
      take: limit,
    });

    const batchStatuses = [];

    for (const batch of batches) {
      const status = await this.getBatchStatus(batch.batchId, user);
      batchStatuses.push({
        ...status,
        created_at: batch._min.createdAt,
      });
    }

    return batchStatuses;
  }
}
