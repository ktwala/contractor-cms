import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';
import * as zlib from 'zlib';

export interface ArchiveResult {
  batch_id: string;
  total_archived: number;
  status: string;
}

@Injectable()
export class DataArchivingService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a data retention policy
   */
  async createRetentionPolicy(
    policyName: string,
    entityType: string,
    retentionPeriodMonths: number,
    archiveAfterMonths: number,
    legalEntityId: string | null,
    autoArchive: boolean,
    autoDelete: boolean,
    userId: string,
  ): Promise<string> {
    const policy = await (this.prisma as any).dataRetentionPolicy.create({
      data: {
        policyName,
        entityType,
        retentionPeriodMonths,
        archiveAfterMonths,
        legalEntityId,
        autoArchive,
        autoDelete,
        createdBy: userId,
      },
    });

    return policy.id;
  }

  /**
   * Archive records based on a policy
   */
  async archiveByPolicy(policyId: string, userId: string): Promise<ArchiveResult> {
    // Get policy details
    const policy = await (this.prisma as any).dataRetentionPolicy.findFirst({
      where: { id: policyId, isActive: true },
    });

    if (!policy) {
      throw new Error('Policy not found or inactive');
    }

    // Create archive batch
    const batch = await (this.prisma as any).archiveBatch.create({
      data: {
        batchName: `${policy.policyName} - ${new Date().toISOString()}`,
        entityType: policy.entityType,
        policyId,
        status: 'in_progress',
        createdBy: userId,
        startedAt: new Date(),
      },
    });

    try {
      // Archive records based on entity type
      const archivedCount = await this.archiveEntityType(
        batch.id,
        policy.entityType,
        policy.archiveAfterMonths,
        policy.legalEntityId,
        userId,
      );

      // Update batch as completed
      await (this.prisma as any).archiveBatch.update({
        where: { id: batch.id },
        data: {
          status: 'completed',
          totalRecords: archivedCount,
          completedAt: new Date(),
        },
      });

      return {
        batch_id: batch.id,
        total_archived: archivedCount,
        status: 'completed',
      };
    } catch (error: any) {
      // Update batch as failed
      await (this.prisma as any).archiveBatch.update({
        where: { id: batch.id },
        data: {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Archive specific entity type records
   */
  private async archiveEntityType(
    batchId: string,
    entityType: string,
    archiveAfterMonths: number,
    legalEntityId: string | null,
    userId: string,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - archiveAfterMonths);

    let recordsToArchive: any[] = [];

    switch (entityType) {
      case 'payslip':
        recordsToArchive = await this.getOldPayslips(cutoffDate, legalEntityId);
        break;
      case 'payrun':
        recordsToArchive = await this.getOldPayruns(cutoffDate, legalEntityId);
        break;
      case 'employee':
        recordsToArchive = await this.getTerminatedEmployees(cutoffDate, legalEntityId);
        break;
      case 'audit_log':
        recordsToArchive = await this.getOldAuditLogs(cutoffDate, legalEntityId);
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // Archive each record
    let archivedCount = 0;
    for (const record of recordsToArchive) {
      await this.archiveRecord(
        batchId,
        entityType,
        record.id,
        record,
        legalEntityId,
        'Automatic archival based on retention policy',
        userId,
      );
      archivedCount++;
    }

    return archivedCount;
  }

  /**
   * Archive a single record
   */
  async archiveRecord(
    batchId: string,
    entityType: string,
    entityId: string,
    recordData: any,
    legalEntityId: string | null,
    reason: string,
    userId: string,
  ): Promise<string> {
    // Compress the record data
    const compressedData = this.compressData(recordData);

    const archive = await (this.prisma as any).archivedRecord.create({
      data: {
        archiveBatchId: batchId,
        entityType,
        entityId,
        legalEntityId,
        archiveData: compressedData,
        archiveReason: reason,
        originalCreatedAt: recordData.createdAt || new Date(),
        archivedBy: userId,
      },
    });

    return archive.id;
  }

  /**
   * Restore an archived record
   */
  async restoreRecord(archiveId: string): Promise<any> {
    const archive = await (this.prisma as any).archivedRecord.findUnique({
      where: { id: archiveId },
    });

    if (!archive) {
      throw new Error('Archive record not found');
    }

    // Decompress data
    const recordData = this.decompressData(archive.archiveData);

    // Update restore count
    await (this.prisma as any).archivedRecord.update({
      where: { id: archiveId },
      data: {
        restoreCount: { increment: 1 },
        lastRestoredAt: new Date(),
      },
    });

    return {
      archive_id: archiveId,
      entity_type: archive.entityType,
      entity_id: archive.entityId,
      data: recordData,
      archived_at: archive.archivedAt,
    };
  }

  /**
   * Get archived records
   */
  async getArchivedRecords(
    entityType?: string,
    legalEntityId?: string,
    fromDate?: string,
    toDate?: string,
    limit: number = 100,
  ): Promise<any[]> {
    return (this.prisma as any).archivedRecord.findMany({
      where: {
        ...(entityType && { entityType }),
        ...(legalEntityId && { legalEntityId }),
        ...(fromDate && { archivedAt: { gte: new Date(fromDate) } }),
        ...(toDate && { archivedAt: { lte: new Date(toDate) } }),
      },
      select: {
        id: true,
        archiveBatchId: true,
        entityType: true,
        entityId: true,
        archiveReason: true,
        originalCreatedAt: true,
        archivedAt: true,
        restoreCount: true,
      },
      orderBy: { archivedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Automated archival job - runs daily
   */
  @Cron('0 2 * * *') // 2 AM daily
  async runAutomatedArchival(): Promise<void> {
    console.log('Running automated archival job...');

    // Get all active auto-archive policies
    const policies = await (this.prisma as any).dataRetentionPolicy.findMany({
      where: { isActive: true, autoArchive: true },
      select: { id: true },
    });

    for (const policy of policies) {
      try {
        await this.archiveByPolicy(policy.id, 'system');
        console.log(`Completed archival for policy: ${policy.id}`);
      } catch (error: any) {
        console.error(`Failed to archive for policy ${policy.id}:`, error.message);
      }
    }

    console.log('Automated archival job completed');
  }

  /**
   * Get old payslips to archive
   */
  private async getOldPayslips(cutoffDate: Date, legalEntityId: string | null): Promise<any[]> {
    return (this.prisma as any).paySlip.findMany({
      where: {
        payRun: {
          createdAt: { lt: cutoffDate },
        },
      },
      take: 1000,
    });
  }

  /**
   * Get old payruns to archive
   */
  private async getOldPayruns(cutoffDate: Date, legalEntityId: string | null): Promise<any[]> {
    return (this.prisma as any).payRun.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: 'APPROVED',
      },
      take: 1000,
    });
  }

  /**
   * Get terminated employees to archive
   */
  private async getTerminatedEmployees(cutoffDate: Date, legalEntityId: string | null): Promise<any[]> {
    return (this.prisma as any).employee.findMany({
      where: {
        status: 'TERMINATED',
        endDate: { lt: cutoffDate },
      },
      take: 1000,
    });
  }

  /**
   * Get old audit logs to archive
   */
  private async getOldAuditLogs(cutoffDate: Date, legalEntityId: string | null): Promise<any[]> {
    return (this.prisma as any).auditLog.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      take: 1000,
    });
  }

  /**
   * Compress data for storage
   */
  private compressData(data: any): string {
    const jsonString = JSON.stringify(data);
    const compressed = zlib.gzipSync(jsonString);
    return compressed.toString('base64');
  }

  /**
   * Decompress archived data
   */
  private decompressData(compressedData: string): any {
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressed = zlib.gunzipSync(buffer);
    return JSON.parse(decompressed.toString());
  }
}
