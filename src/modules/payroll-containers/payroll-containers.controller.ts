import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PayrollContainersService } from './payroll-containers.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

/**
 * PR-PAYROLL-CONTAINER-1 … PR-PAYROLL-CONTAINER-4 — tax-year payroll shells.
 * Read APIs use pay_group:read; lifecycle uses governed POST only (no DELETE).
 */
@ApiTags('Payrolls')
@ApiBearerAuth('bearerAuth')
@Controller('payrolls')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayrollContainersController {
  constructor(private readonly payrollContainersService: PayrollContainersService) {}

  @Get()
  @Permissions('pay_group:read')
  @ApiOperation({ summary: 'List payroll tax-year containers (scoped by legal entity access)' })
  @ApiQuery({ name: 'pay_group_id', required: false })
  async list(
    @Query('pay_group_id') payGroupId: string | undefined,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.payrollContainersService.findAll(user, payGroupId);
  }

  @Get('linkage-health')
  @Permissions('pay_group:read')
  @ApiOperation({ summary: 'Count pay periods without a payroll shell (scoped); for hub warning banner' })
  async linkageHealth(@CurrentUser() user: CurrentUserData) {
    return this.payrollContainersService.getLinkageHealth(user);
  }

  @Get(':id/lifecycle-eligibility')
  @Permissions('pay_group:read')
  @ApiOperation({ summary: 'Preview close/archive governance gates (read-only)' })
  async lifecycleEligibility(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.payrollContainersService.getLifecycleEligibility(id, user);
  }

  @Post(':id/close')
  @Permissions('payroll:containers:close')
  @ApiOperation({ summary: 'Close tax-year shell (no linked in-flight payruns)' })
  @ApiBody({
    required: false,
    schema: { type: 'object', properties: { reason: { type: 'string', maxLength: 500 } } },
  })
  async close(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.payrollContainersService.close(id, user, body);
  }

  @Post(':id/archive')
  @Permissions('payroll:containers:archive')
  @ApiOperation({
    summary:
      'Archive shell only when safe (no governance-closed periods; no in-flight or executed payruns on linked periods)',
  })
  @ApiBody({
    required: false,
    schema: { type: 'object', properties: { reason: { type: 'string', maxLength: 500 } } },
  })
  async archive(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.payrollContainersService.archive(id, user, body);
  }

  @Get(':id')
  @Permissions('pay_group:read')
  @ApiOperation({ summary: 'Get one payroll tax-year container with linked periods' })
  async getOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.payrollContainersService.findOne(id, user);
  }
}
