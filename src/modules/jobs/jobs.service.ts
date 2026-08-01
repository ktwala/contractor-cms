import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateJobDto, ListJobsDto, JobStatus, JobType } from './dto/job.dto';
import { Prisma, JobStatus as PrismaJobStatus, JobKind } from '@prisma/client';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateJobDto, createdBy: string) {
    const job = await this.prisma.job.create({
      data: {
        kind: dto.type as JobKind,
        status: PrismaJobStatus.QUEUED,
        payrunId: (dto.payload as any)?.payrun_id || null,
        importId: (dto.payload as any)?.import_id || null,
        artifactId: (dto.payload as any)?.artifact_id || null,
      },
    });

    // In a real implementation, we'd queue the job here
    // For now, we'll process it synchronously or mark it for async processing
    this.scheduleJobExecution(job.id);

    return job;
  }

  async findAll(query: ListJobsDto) {
    const { type, status, reference_id, page = 1, limit = 20 } = query;

    const where: Prisma.JobWhereInput = {};

    if (type) {
      where.kind = type as JobKind;
    }

    if (status) {
      where.status = status as PrismaJobStatus;
    }

    if (reference_id) {
      where.OR = [
        { payrunId: reference_id },
        { importId: reference_id },
        { artifactId: reference_id },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    return job;
  }

  async cancel(id: string, userId: string) {
    const job = await this.findOne(id);

    if (job.status !== PrismaJobStatus.QUEUED && job.status !== PrismaJobStatus.RUNNING) {
      throw new BadRequestException(
        `Cannot cancel job in ${job.status} status`,
      );
    }

    return this.prisma.job.update({
      where: { id },
      data: {
        status: PrismaJobStatus.FAILED, // CANCELLED doesn't exist, use FAILED
        endedAt: new Date(),
      },
    });
  }

  async updateProgress(id: string, progress: number, result?: Record<string, any>) {
    // Job model doesn't have progress field, skip update
    return this.prisma.job.findUnique({ where: { id } });
  }

  async markRunning(id: string) {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: PrismaJobStatus.RUNNING,
        startedAt: new Date(),
      },
    });
  }

  async markCompleted(id: string, result?: Record<string, any>) {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: PrismaJobStatus.SUCCEEDED,
        endedAt: new Date(),
      },
    });
  }

  async markFailed(id: string, error: string) {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: PrismaJobStatus.FAILED,
        errorMessage: error,
        endedAt: new Date(),
      },
    });
  }

  /**
   * Schedule job for async execution
   * In production, this would push to a message queue (Redis, NATS, etc.)
   */
  private async scheduleJobExecution(jobId: string) {
    // For MVP, we'll use a simple setTimeout to simulate async processing
    // In production, replace with proper job queue (Bull, Agenda, etc.)
    setImmediate(async () => {
      try {
        await this.executeJob(jobId);
      } catch (error) {
        await this.markFailed(jobId, error.message);
      }
    });
  }

  /**
   * Execute the job based on its type
   */
  private async executeJob(jobId: string) {
    const job = await this.findOne(jobId);
    await this.markRunning(jobId);

    switch (job.kind) {
      case 'PAYRUN_CALCULATE':
        // Delegate to payrun calculation service
        // This would be injected in a real implementation
        await this.simulateJobExecution(jobId, 5000);
        break;

      case 'EXPORT_BANK_FILE':
      case 'EXPORT_GL_JOURNAL':
      case 'EXPORT_PAYSLIPS':
      case 'EXPORT_STATUTORY':
        await this.simulateJobExecution(jobId, 4000);
        break;

      case 'IMPORT_VARIABLE_PAY':
      case 'IMPORT_TAX_TABLES':
        await this.simulateJobExecution(jobId, 6000);
        break;

      default:
        throw new Error(`Unknown job type: ${job.kind}`);
    }

    await this.markCompleted(jobId, { message: 'Job completed successfully' });
  }

  /**
   * Simulate job execution with progress updates
   * Replace with actual implementation per job type
   */
  private async simulateJobExecution(jobId: string, durationMs: number) {
    const steps = 10;
    const stepDuration = durationMs / steps;

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      await this.updateProgress(jobId, i * 10);
    }
  }

  /**
   * Find jobs by reference (e.g., payrun_id)
   */
  async findByReference(referenceId: string, referenceType: string) {
    return this.prisma.job.findMany({
      where: {
        OR: [
          { payrunId: referenceId },
          { importId: referenceId },
          { artifactId: referenceId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get the latest job for a reference
   */
  async getLatestJobForReference(referenceId: string, referenceType: string, jobType?: JobType) {
    const where: Prisma.JobWhereInput = {
      OR: [
        { payrunId: referenceId },
        { importId: referenceId },
        { artifactId: referenceId },
      ],
    };

    if (jobType) {
      where.kind = jobType as any;
    }

    return this.prisma.job.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }
}
