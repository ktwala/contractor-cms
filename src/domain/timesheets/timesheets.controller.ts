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
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('timesheets')
@Controller('timesheets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Post()
  @Permissions('timesheets:create')
  @ApiOperation({ summary: 'Create a new timesheet' })
  @ApiResponse({
    status: 201,
    description: 'Timesheet created successfully',
    type: TimesheetResponseDto,
  })
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createTimesheetDto: CreateTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.create(organizationId, createTimesheetDto);
  }

  @Get()
  @Permissions('timesheets:read')
  @ApiOperation({
    summary: 'Get all timesheets with pagination and filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'List of timesheets',
    type: PaginatedTimesheetResponseDto,
  })
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: QueryTimesheetDto,
  ): Promise<PaginatedTimesheetResponseDto> {
    return this.timesheetsService.findAll(organizationId, query);
  }

  @Get(':id')
  @Permissions('timesheets:read')
  @ApiOperation({ summary: 'Get timesheet by ID' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet details',
    type: TimesheetResponseDto,
  })
  async findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Permissions('timesheets:update')
  @ApiOperation({ summary: 'Update timesheet (draft only)' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet updated successfully',
    type: TimesheetResponseDto,
  })
  async update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateTimesheetDto: UpdateTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.update(
      organizationId,
      id,
      updateTimesheetDto,
    );
  }

  @Delete(':id')
  @Permissions('timesheets:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete timesheet (draft/rejected only)' })
  @ApiResponse({ status: 204, description: 'Timesheet deleted successfully' })
  async remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.timesheetsService.remove(organizationId, id);
  }

  @Patch(':id/submit')
  @Permissions('timesheets:submit')
  @ApiOperation({ summary: 'Submit timesheet for approval' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet submitted',
    type: TimesheetResponseDto,
  })
  async submit(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.submit(organizationId, id);
  }

  @Patch(':id/approve')
  @Permissions('timesheets:approve')
  @ApiOperation({ summary: 'Approve submitted timesheet' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet approved',
    type: TimesheetResponseDto,
  })
  async approve(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() approveDto: ApproveTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.approve(organizationId, id, userId);
  }

  @Patch(':id/reject')
  @Permissions('timesheets:approve')
  @ApiOperation({ summary: 'Reject submitted timesheet' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet rejected',
    type: TimesheetResponseDto,
  })
  async reject(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() rejectDto: RejectTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    return this.timesheetsService.reject(
      organizationId,
      id,
      rejectDto.rejectionReason,
    );
  }
}
