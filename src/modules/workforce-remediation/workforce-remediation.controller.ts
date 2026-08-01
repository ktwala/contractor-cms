import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WorkforceRemediationService } from './workforce-remediation.service';
import { BulkRemediationPreviewRequest, BulkRemediationApplyRequest, ISSUE_TO_REMEDIATION } from './bulk-remediation.types';
import { evaluatePolicy, assertSingleLegalEntity } from '../workforce-remediation-governance/policy-engine';

@Controller('workforce-remediation')
@UseGuards(AuthGuard('jwt'))
export class WorkforceRemediationController {
  constructor(private readonly service: WorkforceRemediationService) {}

  @Post('preview')
  async preview(@Body() body: BulkRemediationPreviewRequest) {
    const result = await this.service.preview(body);

    const actionType = ISSUE_TO_REMEDIATION[body.issueType];
    const policyCheck = actionType ? evaluatePolicy(actionType, result.recordsAffected) : { requiresApproval: false };

    return { ...result, policyCheck };
  }

  @Post('apply')
  async apply(@Body() body: BulkRemediationApplyRequest, @Req() req: any) {
    const userId = req.user?.sub ?? 'system';

    const actionType = ISSUE_TO_REMEDIATION[body.issueType];
    if (actionType) {
      const preview = await this.service.preview({
        issueType: body.issueType,
        filters: body.filters,
        proposedFix: body.fix,
      });
      const policy = evaluatePolicy(actionType, preview.recordsAffected);
      if (policy.blocked) {
        throw new HttpException(
          { code: 'POLICY_BLOCKED', message: policy.blockReason },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (policy.requiresApproval) {
        throw new HttpException(
          {
            code: 'APPROVAL_REQUIRED',
            message: policy.reason,
            requiresApproval: true,
            actionType,
            recordsAffected: preview.recordsAffected,
          },
          HttpStatus.CONFLICT,
        );
      }

      // Cross-legal-entity guard for employment operations
      try {
        const leIds = preview.employees
          ?.map((e: any) => e.legalEntityName)
          .filter(Boolean) as string[];
        if (leIds && leIds.length > 0) {
          assertSingleLegalEntity([...new Set(leIds)], actionType);
        }
      } catch (err: any) {
        throw new HttpException({ code: 'POLICY_BLOCKED', message: err.message }, HttpStatus.BAD_REQUEST);
      }
    }

    return this.service.apply(body, userId);
  }

  @Get('history')
  async getHistory(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('actionType') actionType?: string,
    @Query('issueType') issueType?: string,
    @Query('legalEntityId') legalEntityId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.service.getHistory({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      actionType,
      issueType,
      legalEntityId,
      userId,
    });
  }

  @Get('legal-entity-progress')
  async getLegalEntityProgress() {
    return this.service.getLegalEntityProgress();
  }

  @Get('import-analysis/:jobId')
  async getImportAnalysis(@Param('jobId') jobId: string) {
    return this.service.getImportAnalysis(jobId);
  }
}
