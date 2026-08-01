import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { EmploymentsService } from './employments.service';
import { CreateEmploymentDto } from './dto/create-employment.dto';
import { EmploymentResponseDto, EmploymentHistoryResponseDto } from './dto/employment-response.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ApiReasonHeader } from '../../common/decorators/api-headers.decorator';

@ApiTags('Employees')
@ApiBearerAuth('bearerAuth')
@Controller('employees')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class EmploymentsController {
  constructor(private readonly employmentsService: EmploymentsService) {}

  @Post(':employee_id/employments')
  @Permissions('employment:write')
  @ApiOperation({ summary: 'Add an employment record (effective-dated link to legal entity + pay group + country)' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiReasonHeader()
  @ApiResponse({ status: 201, description: 'Created', type: EmploymentResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(
    @Param('employee_id') employeeId: string,
    @Body() dto: CreateEmploymentDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<EmploymentResponseDto> {
    return this.employmentsService.create(employeeId, dto, user.sub, reason);
  }

  @Get(':employee_id/employments')
  @Permissions('employment:read')
  @ApiOperation({ summary: 'List employment history' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiQuery({
    name: 'include_assignments',
    required: false,
    type: Boolean,
    description: 'When true, include full assignment history (assignments array). Default returns only current_assignment and next_assignment.',
  })
  @ApiResponse({ status: 200, description: 'OK', type: EmploymentHistoryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async list(
    @Param('employee_id') employeeId: string,
    @Query('include_assignments') includeAssignments?: string,
  ): Promise<EmploymentHistoryResponseDto> {
    const include_assignments = includeAssignments === 'true' || includeAssignments === '1';
    return this.employmentsService.listForEmployee(employeeId, { include_assignments });
  }
}
