import { Controller, Get, Post, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PayrollComplianceService } from './payroll-compliance.service';

@Controller('payroll/compliance')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayrollComplianceController {
  constructor(private readonly complianceService: PayrollComplianceService) {}

  @Get('reports')
  @Permissions('compliance:read')
  async listReports(
    @Query('countryCode') countryCode?: string,
    @Query('reportType') reportType?: string,
    @Query('status') status?: string,
    @Query('submissionStatus') submissionStatus?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.complianceService.listReports({
      countryCode, reportType, status, submissionStatus,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50,
    });
  }

  @Get('reports/:id')
  @Permissions('compliance:read')
  async getReport(@Param('id') id: string) {
    return this.complianceService.getReport(id);
  }

  @Post('reports/generate')
  @Permissions('compliance:write')
  async generateReport(
    @Body() body: { payrunId: string; reportType: string },
    @Req() req: any,
  ) {
    return this.complianceService.generateReport(body.payrunId, body.reportType, req.user?.sub);
  }

  @Post('reports/:id/submit')
  @Permissions('compliance:write')
  async submitReport(
    @Param('id') id: string,
    @Body() body: { submissionReference: string },
    @Req() req: any,
  ) {
    return this.complianceService.submitReport(id, body.submissionReference, req.user?.sub);
  }

  @Post('reports/:id/update-status')
  @Permissions('compliance:write')
  async updateReportStatus(
    @Param('id') id: string,
    @Body() body: { status: string; authorityReference?: string },
    @Req() req: any,
  ) {
    return this.complianceService.updateReportStatus(id, body.status, body.authorityReference, req.user?.sub);
  }
}
