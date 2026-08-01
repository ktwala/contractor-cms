import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PayrollResultsService } from './payroll-results.service';

@Controller('payroll/results')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayrollResultsController {
  constructor(private readonly resultsService: PayrollResultsService) {}

  @Get('payruns/:payrunId')
  @Permissions('payrun:read')
  async getPayrunResults(
    @Param('payrunId') payrunId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.resultsService.getPayrunResults(
      payrunId,
      offset ? parseInt(offset, 10) : 0,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Get('payruns/:payrunId/employees/:employeeId')
  @Permissions('payrun:read')
  async getEmployeeResult(
    @Param('payrunId') payrunId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.resultsService.getEmployeeResultDetail(payrunId, employeeId);
  }
}
