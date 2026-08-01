import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RunCenterService } from './run-center.service';

@Controller('run-center')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RunCenterController {
  constructor(private readonly runCenterService: RunCenterService) {}

  @Get('summary')
  @Permissions('payrun:read')
  async getSummary() {
    return this.runCenterService.getSummary();
  }

  @Get('periods')
  @Permissions('payrun:read')
  async getCurrentPeriods() {
    return this.runCenterService.getCurrentPeriods();
  }

  @Get('alerts')
  @Permissions('payrun:read')
  async getCriticalAlerts() {
    return this.runCenterService.getCriticalAlerts();
  }

  @Get('payruns')
  @Permissions('payrun:read')
  async getActivePayruns() {
    return this.runCenterService.getActivePayruns();
  }

  @Get('payments')
  @Permissions('payrun:read')
  async getPendingPayments() {
    return this.runCenterService.getPendingPayments();
  }

  @Get('reconciliation')
  @Permissions('payrun:read')
  async getReconciliationStatus() {
    return this.runCenterService.getReconciliationStatus();
  }

  @Get('compliance')
  @Permissions('payrun:read')
  async getComplianceStatus() {
    return this.runCenterService.getComplianceStatus();
  }

  @Get('finalization-readiness/:payrunId')
  @Permissions('payrun:read')
  async getFinalizationReadiness(@Param('payrunId') payrunId: string) {
    return this.runCenterService.getFinalizationReadiness(payrunId);
  }
}
