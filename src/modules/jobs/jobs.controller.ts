import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import {
  CreateJobDto,
  ListJobsDto,
  JobResponseDto,
  JobListResponseDto,
} from './dto/job.dto';

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new async job' })
  @ApiResponse({ status: 201, type: JobResponseDto })
  @RequirePermissions('jobs:create')
  async create(@Body() dto: CreateJobDto, @CurrentUser() user: any) {
    return this.jobsService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List jobs with filters' })
  @ApiResponse({ status: 200, type: JobListResponseDto })
  @RequirePermissions('jobs:read')
  async findAll(@Query() query: ListJobsDto) {
    return this.jobsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job status and details' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 200, type: JobResponseDto })
  @RequirePermissions('jobs:read')
  async findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending or running job' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 200, type: JobResponseDto })
  @RequirePermissions('jobs:cancel')
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.jobsService.cancel(id, user.sub);
  }
}
