import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TaxTableImpactAnalysisRunRepository } from './tax-table-impact-analysis-run.repository';
import { CreateImpactReviewDto } from './dto/create-impact-review.dto';
import { TtaException, TTA_ERROR_CODES } from '../tax-table-authoring/types/error-codes';

@Injectable()
export class TaxTableImpactAnalysisReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runRepository: TaxTableImpactAnalysisRunRepository,
  ) {}

  async review(
    runId: string,
    dto: CreateImpactReviewDto,
    actorUserId: string,
  ) {
    const run = await this.runRepository.getRun(runId);
    if (!run) {
      throw new TtaException(
        TTA_ERROR_CODES.IMPACT_RUN_NOT_FOUND,
        'Impact analysis run not found',
        undefined,
        404,
      );
    }

    const authoring = await this.prisma.taxTableAuthoringVersion.findUnique({
      where: { id: run.authoringVersionId },
    });
    if (!authoring) {
      throw new TtaException(
        TTA_ERROR_CODES.NOT_FOUND,
        'Authoring version not found',
        undefined,
        404,
      );
    }

    const stale = authoring.updatedAt.getTime() > run.runAt.getTime();
    if (stale && dto.reviewStatus === 'ACCEPTED') {
      throw new TtaException(
        TTA_ERROR_CODES.IMPACT_REVIEW_FOR_STALE_RUN,
        'Cannot accept a stale impact analysis run. The draft has changed since this analysis was performed.',
        undefined,
        409,
      );
    }

    return this.runRepository.createReview({
      impactAnalysisRunId: run.id,
      authoringVersionId: run.authoringVersionId,
      reviewStatus: dto.reviewStatus,
      reviewComment: dto.reviewComment ?? null,
      reviewedByUserId: actorUserId,
    });
  }
}
