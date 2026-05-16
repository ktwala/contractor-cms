import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { TimesheetsService } from './timesheets.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import { QueryTimesheetDto } from './dto/query-timesheet.dto';
import {
  TimesheetResponseDto,
  PaginatedTimesheetResponseDto,
} from './dto/timesheet-response.dto';
import {
  ApproveTimesheetDto,
  RejectTimesheetDto,
} from './dto/approve-timesheet.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('timesheets')
@Controller('timesheets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Post()
  @Permissions('timesheets:create')
  @RequiresOrgContext({ type: 'body', key: 'projectId', lookup: 'Project' })
  @ApiOperation({ summary: 'Create a new timesheet' })
  @ApiResponse({
    status: 201,
    description: 'Timesheet created successfully',
    type: TimesheetResponseDto,
  })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() createTimesheetDto: CreateTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.create(accessContext, createTimesheetDto);
  }

  @Get()
  @Permissions('timesheets:read', 'supplier-timesheets:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Get all timesheets with pagination and filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'List of timesheets',
    type: PaginatedTimesheetResponseDto,
  })
  async findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryTimesheetDto,
  ): Promise<PaginatedTimesheetResponseDto> {
    return this.timesheetsService.findAll(accessContext, query);
  }

  @Get(':id')
  @Permissions('timesheets:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Timesheet' })
  @ApiOperation({ summary: 'Get timesheet by ID' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet details',
    type: TimesheetResponseDto,
  })
  async findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.findOne(accessContext, id);
  }

  @Patch(':id')
  @Permissions('timesheets:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Timesheet' })
  @ApiOperation({ summary: 'Update timesheet' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet updated successfully',
    type: TimesheetResponseDto,
  })
  async update(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() updateTimesheetDto: UpdateTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.update(accessContext, id, updateTimesheetDto);
  }

  @Delete(':id')
  @Permissions('timesheets:delete')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Timesheet' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete timesheet (draft only)' })
  @ApiResponse({ status: 204, description: 'Timesheet deleted successfully' })
  async remove(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.timesheetsService.remove(accessContext, id);
  }

  @Patch(':id/submit')
  @Permissions('timesheets:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Timesheet' })
  @ApiOperation({ summary: 'Submit timesheet for approval' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet submitted',
    type: TimesheetResponseDto,
  })
  async submit(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.submit(accessContext, id);
  }

  @Patch(':id/approve')
  @Permissions('timesheets:approve')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Timesheet' })
  @ApiOperation({ summary: 'Approve timesheet' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet approved',
    type: TimesheetResponseDto,
  })
  async approve(
    @CurrentAccessContext() accessContext: AccessContext,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ApproveTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.approve(accessContext, id, userId, dto);
  }

  @Patch(':id/reject')
  @Permissions('timesheets:approve')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Timesheet' })
  @ApiOperation({ summary: 'Reject timesheet' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet rejected',
    type: TimesheetResponseDto,
  })
  async reject(
    @CurrentAccessContext() accessContext: AccessContext,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: RejectTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.reject(accessContext, id, userId, dto);
  }
}
