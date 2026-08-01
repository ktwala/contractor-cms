import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class TaxTableImpactAnalysisRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRunWithRows(input: { run: any; rows: any[] }) {
    return this.prisma.$transaction(async (tx) => {
      const createdRun = await tx.taxTableImpactAnalysisRun.create({
        data: input.run,
      });

      if (input.rows.length > 0) {
        await tx.taxTableImpactAnalysisRowSnapshot.createMany({
          data: input.rows.map((row) => ({
            ...row,
            runId: createdRun.id,
          })),
        });
      }

      return createdRun;
    });
  }

  async listRunsForAuthoring(authoringVersionId: string) {
    return this.prisma.taxTableImpactAnalysisRun.findMany({
      where: { authoringVersionId },
      include: {
        reviews: {
          orderBy: { reviewedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { runAt: 'desc' },
    });
  }

  async getRun(runId: string) {
    return this.prisma.taxTableImpactAnalysisRun.findUnique({
      where: { id: runId },
      include: {
        rows: true,
        reviews: {
          orderBy: { reviewedAt: 'desc' },
        },
      },
    });
  }

  async getLatestRunForAuthoring(authoringVersionId: string) {
    return this.prisma.taxTableImpactAnalysisRun.findFirst({
      where: { authoringVersionId },
      include: {
        reviews: {
          orderBy: { reviewedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { runAt: 'desc' },
    });
  }

  async createReview(input: {
    impactAnalysisRunId: string;
    authoringVersionId: string;
    reviewStatus: string;
    reviewComment?: string | null;
    reviewedByUserId: string;
  }) {
    return this.prisma.taxTableImpactAnalysisReview.create({
      data: input,
    });
  }
}
