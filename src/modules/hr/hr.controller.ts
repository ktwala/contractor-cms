import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { HrService } from './hr.service';
import { HrEmployeesQueryDto } from './dto/hr-employees-query.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

/**
 * HR export surface for JML/IGA and downstream systems.
 * Read-only, stable contract at /v1/hr.
 */
@ApiTags('HR Export')
@ApiBearerAuth('bearerAuth')
@Controller('hr')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get('legal-entities')
  @Permissions('hr:read')
  @ApiOperation({ summary: 'List legal entities (HR contract, includes updated_at)' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLegalEntities() {
    return this.hrService.getLegalEntities();
  }

  @Get('employees')
  @Permissions('hr:read')
  @ApiOperation({
    summary: 'Employees delta feed (changed_since, cursor, include, as_of for point-in-time current_employment)',
  })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getEmployees(@Query() query: HrEmployeesQueryDto) {
    return this.hrService.getEmployeesDelta({
      changed_since: query.changed_since,
      limit: query.limit,
      cursor: query.cursor,
      include: query.include,
      as_of: query.as_of,
    });
  }

  @Get('employees/by-employee-no/:employee_no')
  @Permissions('hr:read')
  @ApiOperation({ summary: 'Get employee by employee_no (IGA-friendly key). Optional as_of for point-in-time current_employment.' })
  @ApiParam({ name: 'employee_no', example: 'E000123' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getByEmployeeNo(
    @Param('employee_no') employeeNo: string,
    @Query('as_of') asOf?: string,
  ) {
    return this.hrService.getByEmployeeNo(employeeNo, asOf);
  }

  @Get('employees/:employee_no/employments')
  @Permissions('hr:read')
  @ApiOperation({ summary: 'Employment history by employee_no' })
  @ApiParam({ name: 'employee_no', example: 'E000123' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getEmploymentsByEmployeeNo(@Param('employee_no') employeeNo: string) {
    return this.hrService.getEmploymentsByEmployeeNo(employeeNo);
  }
}
