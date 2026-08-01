import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AnyPermissions } from '../../common/decorators/permissions.decorator';
import { PayrollReadinessService } from './payroll-readiness.service';

@Controller('payroll/readiness')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayrollReadinessController {
  constructor(private readonly service: PayrollReadinessService) {}

  @Get('pay-groups/:payGroupId')
  @AnyPermissions('payrun:read', 'pay_group:read')
  getPayGroupReadiness(@Param('payGroupId') payGroupId: string) {
    return this.service.getPayGroupReadiness(payGroupId);
  }
}
