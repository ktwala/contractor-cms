import { Controller, Post, Get, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RemediationApprovalService } from './approval.service';
import { ApprovalRequestDto, ApprovalRejectDto } from './approval.types';

@Controller('workforce-remediation')
@UseGuards(AuthGuard('jwt'))
export class RemediationApprovalController {
  constructor(private readonly service: RemediationApprovalService) {}

  @Post('check-policy')
  async checkPolicy(@Body() body: { actionType: string; recordsAffected: number }) {
    return this.service.checkPolicy(body.actionType, body.recordsAffected);
  }

  @Post('request-approval')
  async requestApproval(@Body() body: ApprovalRequestDto, @Req() req: any) {
    const userId = req.user?.sub ?? 'system';
    return this.service.submitApprovalRequest(body, userId);
  }

  @Get('approvals')
  async listApprovals(
    @Query('status') status?: string,
    @Query('requestedByUserId') requestedByUserId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listApprovals({
      status,
      requestedByUserId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('approvals/pending-count')
  async getPendingCount() {
    return { count: await this.service.getPendingCount() };
  }

  @Get('approvals/:id')
  async getApproval(@Param('id') id: string) {
    return this.service.getApprovalById(id);
  }

  @Post('approvals/:id/approve')
  async approve(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub ?? 'system';
    return this.service.approveRequest(id, userId);
  }

  @Post('approvals/:id/reject')
  async reject(@Param('id') id: string, @Body() body: ApprovalRejectDto, @Req() req: any) {
    const userId = req.user?.sub ?? 'system';
    return this.service.rejectRequest(id, userId, body.reason);
  }

  @Post('approvals/:id/execute')
  async execute(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub ?? 'system';
    return this.service.executeApproved(id, userId);
  }

  @Get('audit-trail')
  async getAuditTrail(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getGovernanceAuditTrail({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
