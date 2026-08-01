import { Controller, Get, Post, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PayrunExceptionService } from './payrun-exception.service';

@Controller('payruns')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayrunExceptionController {
  constructor(private readonly exceptionService: PayrunExceptionService) {}

  @Get(':payrun_id/exceptions')
  @Permissions('payrun:read')
  async listExceptions(
    @Param('payrun_id') payrunId: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('ownerUserId') ownerUserId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('blockingOnly') blockingOnly?: string,
  ) {
    return this.exceptionService.listPayrunExceptions(payrunId, {
      severity, status, type, ownerUserId, employeeId,
      blockingOnly: blockingOnly === 'true',
    });
  }

  @Post(':payrun_id/detect-exceptions')
  @Permissions('payrun:calculate')
  async detectExceptions(@Param('payrun_id') payrunId: string) {
    return this.exceptionService.detectCalculationExceptions(payrunId);
  }

  @Get(':payrun_id/exception-summary')
  @Permissions('payrun:read')
  async getExceptionSummary(@Param('payrun_id') payrunId: string) {
    const summary = await this.exceptionService.getExceptionSummary(payrunId);
    const hasSubmissionBlockers = await this.exceptionService.hasSubmissionBlockers(payrunId);
    const hasPaymentBlockers = await this.exceptionService.hasPaymentBlockers(payrunId);
    return {
      ...summary,
      readiness: {
        hasSubmissionBlockers,
        hasPaymentBlockers,
      },
    };
  }
}

@Controller('payrun-exceptions')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayrunExceptionWorkflowController {
  constructor(private readonly exceptionService: PayrunExceptionService) {}

  @Get()
  @Permissions('payrun:read')
  async listGlobalExceptions(
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('ownerUserId') ownerUserId?: string,
    @Query('blockingOnly') blockingOnly?: string,
    @Query('myAssignedOnly') myAssignedOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    return this.exceptionService.listGlobalExceptions({
      severity, status, type, ownerUserId,
      blockingOnly: blockingOnly === 'true',
      myAssignedOnly: myAssignedOnly === 'true',
      actorUserId: req?.user?.sub,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50,
    });
  }

  @Get('summary')
  @Permissions('payrun:read')
  async getGlobalExceptionSummary(@Req() req?: any) {
    return this.exceptionService.getGlobalExceptionSummary(req?.user?.sub);
  }

  @Post(':id/assign')
  @Permissions('payrun:edit')
  async assignException(
    @Param('id') id: string,
    @Body() body: { ownerUserId: string },
    @Req() req: any,
  ) {
    return this.exceptionService.assignException(id, req.user?.sub, body.ownerUserId);
  }

  @Post(':id/resolve')
  @Permissions('payrun:edit')
  async resolveException(
    @Param('id') id: string,
    @Body() body: { resolutionType: string; resolutionNote: string },
    @Req() req: any,
  ) {
    return this.exceptionService.resolveException(id, req.user?.sub, body.resolutionType, body.resolutionNote);
  }

  @Post(':id/dismiss')
  @Permissions('payrun:edit')
  async dismissException(
    @Param('id') id: string,
    @Body() body: { dismissalReason: string },
    @Req() req: any,
  ) {
    return this.exceptionService.dismissException(id, req.user?.sub, body.dismissalReason);
  }
}
