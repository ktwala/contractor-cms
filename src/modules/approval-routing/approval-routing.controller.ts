import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AnyPermissions } from '../../common/decorators/permissions.decorator';
import { ApprovalRoutingService } from './approval-routing.service';
import { SimulateApprovalDto } from './dto/simulate-approval.dto';

@Controller('v1/enterprise/approval-routing')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ApprovalRoutingController {
  constructor(private readonly approvalRoutingService: ApprovalRoutingService) {}

  @Post('simulate')
  @AnyPermissions('iam:legal_entities:manage', 'hr:read', 'employment:read')
  async simulate(@Body() dto: SimulateApprovalDto) {
    return this.approvalRoutingService.simulateRoute(dto);
  }

  @Get('policies')
  @AnyPermissions('iam:legal_entities:manage', 'hr:read', 'employment:read')
  getPolicies() {
    return this.approvalRoutingService.getPolicies();
  }

  @Get('request-types')
  @AnyPermissions('iam:legal_entities:manage', 'hr:read', 'employment:read')
  getRequestTypes() {
    return this.approvalRoutingService.getRequestTypes();
  }

  @Get('fallback-roles')
  @AnyPermissions('iam:legal_entities:manage', 'hr:read', 'employment:read')
  getFallbackRoles() {
    return this.approvalRoutingService.getFallbackRoles();
  }
}
