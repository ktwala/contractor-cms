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
import { EngagementsService } from './engagements.service';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';
import { QueryEngagementDto } from './dto/query-engagement.dto';
import {
  EngagementResponseDto,
  PaginatedEngagementResponseDto,
} from './dto/engagement-response.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('engagements')
@Controller('engagements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class EngagementsController {
  constructor(private readonly engagementsService: EngagementsService) {}

  @Post()
  @Permissions('engagements:create')
  @ApiOperation({ summary: 'Create a new contractor engagement' })
  @ApiResponse({
    status: 201,
    description: 'Engagement created successfully',
    type: EngagementResponseDto,
  })
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createEngagementDto: CreateEngagementDto,
  ): Promise<EngagementResponseDto> {
    return this.engagementsService.create(organizationId, createEngagementDto);
  }

  @Get()
  @Permissions('engagements:read')
  @ApiOperation({
    summary: 'Get all engagements with pagination and filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'List of engagements',
    type: PaginatedEngagementResponseDto,
  })
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: QueryEngagementDto,
  ): Promise<PaginatedEngagementResponseDto> {
    return this.engagementsService.findAll(organizationId, query);
  }

  @Get(':id')
  @Permissions('engagements:read')
  @ApiOperation({ summary: 'Get engagement by ID' })
  @ApiResponse({
    status: 200,
    description: 'Engagement details',
    type: EngagementResponseDto,
  })
  async findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<EngagementResponseDto> {
    return this.engagementsService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Permissions('engagements:update')
  @ApiOperation({ summary: 'Update engagement' })
  @ApiResponse({
    status: 200,
    description: 'Engagement updated successfully',
    type: EngagementResponseDto,
  })
  async update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateEngagementDto: UpdateEngagementDto,
  ): Promise<EngagementResponseDto> {
    return this.engagementsService.update(
      organizationId,
      id,
      updateEngagementDto,
    );
  }

  @Delete(':id')
  @Permissions('engagements:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete engagement (future engagements only)' })
  @ApiResponse({ status: 204, description: 'Engagement deleted successfully' })
  async remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.engagementsService.remove(organizationId, id);
  }

  @Patch(':id/deactivate')
  @Permissions('engagements:update')
  @ApiOperation({ summary: 'Deactivate engagement' })
  @ApiResponse({
    status: 200,
    description: 'Engagement deactivated',
    type: EngagementResponseDto,
  })
  async deactivate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<EngagementResponseDto> {
    return this.engagementsService.deactivate(organizationId, id);
  }
}
