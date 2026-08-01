import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../core/database/prisma.service';
import { TtaException, TTA_ERROR_CODES } from '../tax-table-authoring/types/error-codes';
import { TaxTableImpactAnalysisService } from './tax-table-impact-analysis.service';
import { TaxTableImpactAnalysisExportService } from './tax-table-impact-analysis-export.service';
import { TaxTableImpactAnalysisReviewService } from './tax-table-impact-analysis-review.service';
import { TaxTableImpactAnalysisRunRepository } from './tax-table-impact-analysis-run.repository';
import { TaxTableImpactAnalysisReadinessService } from './tax-table-impact-analysis-readiness.service';
import { RunImpactAnalysisDto } from './dto/run-impact-analysis.dto';
import { CreateImpactReviewDto } from './dto/create-impact-review.dto';
import { ExportImpactAnalysisDto } from './dto/export-impact-analysis.dto';

@ApiTags('Tax Table Impact Analysis')
@Controller('tax-table-impact-analysis')
export class TaxTableImpactAnalysisController {
  constructor(
    private readonly impactAnalysisService: TaxTableImpactAnalysisService,
    private readonly exportService: TaxTableImpactAnalysisExportService,
    private readonly reviewService: TaxTableImpactAnalysisReviewService,
    private readonly runRepository: TaxTableImpactAnalysisRunRepository,
    private readonly readinessService: TaxTableImpactAnalysisReadinessService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('run')
  @ApiOperation({
    summary: 'Run impact analysis for a draft authoring version',
    description:
      'Compares PAYE outcomes between the current active runtime tax table and a draft authoring version across a real employee population. Persists the run and row snapshots.',
  })
  async run(@Body() dto: RunImpactAnalysisDto) {
    const actorUserId = 'TODO_FROM_AUTH_CONTEXT';
    const result = await this.impactAnalysisService.run(dto, actorUserId);
    return { ok: true, data: result };
  }

  @Get('authoring/:authoringVersionId/runs')
  @ApiOperation({ summary: 'List all persisted impact analysis runs for an authoring version' })
  async listRuns(@Param('authoringVersionId') authoringVersionId: string) {
    const runs = await this.runRepository.listRunsForAuthoring(authoringVersionId);
    return { ok: true, data: runs };
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: 'Get a single persisted impact analysis run with rows and reviews' })
  async getRun(@Param('runId') runId: string) {
    const run = await this.runRepository.getRun(runId);
    if (!run) {
      throw new TtaException(
        TTA_ERROR_CODES.IMPACT_RUN_NOT_FOUND,
        'Impact analysis run not found',
        undefined,
        404,
      );
    }
    return { ok: true, data: run };
  }

  @Post('runs/:runId/export')
  @ApiOperation({ summary: 'Export a persisted impact analysis run as CSV' })
  async exportRun(
    @Param('runId') runId: string,
    @Body() dto: ExportImpactAnalysisDto,
    @Res() res: Response,
  ) {
    if (dto.format !== 'CSV') {
      throw new TtaException(
        TTA_ERROR_CODES.IMPACT_EXPORT_UNSUPPORTED,
        `Export format "${dto.format}" is not supported`,
        undefined,
        400,
      );
    }

    const file = await this.exportService.exportCsv(runId);

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return res.send(file.content);
  }

  @Post('runs/:runId/review')
  @ApiOperation({ summary: 'Submit a review/sign-off for an impact analysis run' })
  async reviewRun(
    @Param('runId') runId: string,
    @Body() dto: CreateImpactReviewDto,
  ) {
    const actorUserId = 'TODO_FROM_AUTH_CONTEXT';
    const review = await this.reviewService.review(runId, dto, actorUserId);
    return { ok: true, data: review };
  }

  @Get('authoring/:authoringVersionId/latest-review')
  @ApiOperation({ summary: 'Get latest impact analysis review status and publish readiness' })
  async getLatestReviewStatus(
    @Param('authoringVersionId') authoringVersionId: string,
  ) {
    const authoring = await this.prisma.taxTableAuthoringVersion.findUnique({
      where: { id: authoringVersionId },
    });
    if (!authoring) {
      throw new TtaException(
        TTA_ERROR_CODES.NOT_FOUND,
        'Authoring version not found',
        undefined,
        404,
      );
    }

    const latestRun = await this.runRepository.getLatestRunForAuthoring(authoringVersionId);

    const readiness = this.readinessService.evaluate({
      authoringUpdatedAt: authoring.updatedAt,
      latestRunAt: latestRun?.runAt ?? null,
      latestRunId: latestRun?.id ?? null,
      latestReviewStatus: latestRun?.reviews?.[0]?.reviewStatus ?? null,
      latestReviewAt: latestRun?.reviews?.[0]?.reviewedAt ?? null,
      requireImpactAnalysis: true,
      requireAcceptedReview: false,
      maxAgeHours: 24,
    });

    return {
      ok: true,
      data: {
        latestRunAt: latestRun?.runAt ?? null,
        latestReviewComment: latestRun?.reviews?.[0]?.reviewComment ?? null,
        latestReviewedAt: latestRun?.reviews?.[0]?.reviewedAt ?? null,
        allowed: readiness.allowed,
        stale: readiness.stale,
        reason: readiness.reason,
        latestRunId: readiness.latestRunId,
        latestReviewStatus: readiness.latestReviewStatus,
      },
    };
  }
}
