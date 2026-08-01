import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { ResponsibleManagerTasksService } from './responsible-manager-tasks.service';
import { ResponsibleManagerAccountabilityInboxGuard } from './guards/responsible-manager-accountability-inbox.guard';
import { QueryResponsibleManagerTaskDto } from './dto/query-responsible-manager-task.dto';
import { CompleteResponsibleManagerTaskDto } from './dto/complete-responsible-manager-task.dto';
import {
  PaginatedResponsibleManagerTaskResponseDto,
  ResponsibleManagerTaskResponseDto,
} from './dto/responsible-manager-task-response.dto';

@ApiTags('responsible-manager-tasks')
@Controller('responsible-manager-tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard, ResponsibleManagerAccountabilityInboxGuard)
@ApiBearerAuth()
export class ResponsibleManagerTasksController {
  constructor(private readonly responsibleManagerTasksService: ResponsibleManagerTasksService) {}

  @Get()
  @Permissions('responsible-manager-tasks:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'List sponsor accountability tasks (HCM employee scoped)',
  })
  findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryResponsibleManagerTaskDto,
  ): Promise<PaginatedResponsibleManagerTaskResponseDto> {
    return this.responsibleManagerTasksService.findAll(accessContext, query);
  }

  @Get(':id')
  @Permissions('responsible-manager-tasks:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Get sponsor task by id' })
  findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<ResponsibleManagerTaskResponseDto> {
    return this.responsibleManagerTasksService.findOne(accessContext, id);
  }

  @Patch(':id/complete')
  @Permissions('responsible-manager-tasks:manage')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Complete a sponsor accountability task' })
  complete(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() dto: CompleteResponsibleManagerTaskDto,
  ): Promise<ResponsibleManagerTaskResponseDto> {
    return this.responsibleManagerTasksService.complete(accessContext, id, dto);
  }

  @Patch(':id/dismiss')
  @Permissions('responsible-manager-tasks:manage')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Dismiss a sponsor accountability task' })
  dismiss(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ): Promise<ResponsibleManagerTaskResponseDto> {
    return this.responsibleManagerTasksService.dismiss(accessContext, id, body?.notes);
  }
}
