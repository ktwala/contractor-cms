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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import {
  ProjectResponseDto,
  PaginatedProjectResponseDto,
} from './dto/project-response.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Permissions('projects:create')
  @RequiresOrgContext({ type: 'body', key: 'organizationId' })
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
    type: ProjectResponseDto,
  })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() createProjectDto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.create(accessContext, createProjectDto);
  }

  @Get()
  @Permissions('projects:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get all projects with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of projects',
    type: PaginatedProjectResponseDto,
  })
  async findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryProjectDto,
  ): Promise<PaginatedProjectResponseDto> {
    return this.projectsService.findAll(accessContext, query);
  }

  @Get(':id')
  @Permissions('projects:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Project' })
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({
    status: 200,
    description: 'Project details',
    type: ProjectResponseDto,
  })
  async findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.findOne(accessContext, id);
  }

  @Get(':id/budget-utilization')
  @Permissions('projects:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Project' })
  @ApiOperation({ summary: 'Get project budget utilization' })
  @ApiResponse({
    status: 200,
    description: 'Project budget utilization details',
  })
  async getBudgetUtilization(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ) {
    return this.projectsService.getBudgetUtilization(accessContext, id);
  }

  @Patch(':id')
  @Permissions('projects:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Project' })
  @ApiOperation({ summary: 'Update project' })
  @ApiResponse({
    status: 200,
    description: 'Project updated successfully',
    type: ProjectResponseDto,
  })
  async update(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.update(accessContext, id, updateProjectDto);
  }

  @Delete(':id')
  @Permissions('projects:delete')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Project' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project' })
  @ApiResponse({ status: 204, description: 'Project deleted successfully' })
  async remove(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.projectsService.remove(accessContext, id);
  }
}
