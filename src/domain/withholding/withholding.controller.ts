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
import { WithholdingService } from './withholding.service';
import { CreateWithholdingDto } from './dto/create-withholding.dto';
import { UpdateWithholdingDto } from './dto/update-withholding.dto';
import { QueryWithholdingDto } from './dto/query-withholding.dto';
import {
  WithholdingResponseDto,
  PaginatedWithholdingResponseDto,
} from './dto/withholding-response.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('withholding-instructions')
@Controller('withholding-instructions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class WithholdingController {
  constructor(private readonly withholdingService: WithholdingService) {}

  @Post()
  @Permissions('withholding:create')
  @ApiOperation({ summary: 'Create a new withholding instruction' })
  @ApiResponse({
    status: 201,
    description: 'Withholding instruction created successfully',
    type: WithholdingResponseDto,
  })
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() createDto: CreateWithholdingDto,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.create(organizationId, userId, createDto);
  }

  @Get()
  @Permissions('withholding:read')
  @ApiOperation({
    summary: 'Get all withholding instructions with pagination and filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'List of withholding instructions',
    type: PaginatedWithholdingResponseDto,
  })
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: QueryWithholdingDto,
  ): Promise<PaginatedWithholdingResponseDto> {
    return this.withholdingService.findAll(organizationId, query);
  }

  @Get(':id')
  @Permissions('withholding:read')
  @ApiOperation({ summary: 'Get withholding instruction by ID' })
  @ApiResponse({
    status: 200,
    description: 'Withholding instruction details',
    type: WithholdingResponseDto,
  })
  async findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Permissions('withholding:update')
  @ApiOperation({ summary: 'Update withholding instruction' })
  @ApiResponse({
    status: 200,
    description: 'Withholding instruction updated successfully',
    type: WithholdingResponseDto,
  })
  async update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateWithholdingDto,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.update(organizationId, id, updateDto);
  }

  @Delete(':id')
  @Permissions('withholding:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete withholding instruction' })
  @ApiResponse({
    status: 204,
    description: 'Withholding instruction deleted successfully',
  })
  async remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.withholdingService.remove(organizationId, id);
  }

  @Patch(':id/mark-synced')
  @Permissions('withholding:update')
  @ApiOperation({ summary: 'Mark withholding instruction as synced' })
  @ApiResponse({
    status: 200,
    description: 'Withholding instruction marked as synced',
    type: WithholdingResponseDto,
  })
  async markSynced(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body('externalReference') externalReference: string,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.markSynced(organizationId, id, externalReference);
  }

  @Patch(':id/mark-failed')
  @Permissions('withholding:update')
  @ApiOperation({ summary: 'Mark withholding instruction as failed' })
  @ApiResponse({
    status: 200,
    description: 'Withholding instruction marked as failed',
    type: WithholdingResponseDto,
  })
  async markFailed(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body('error') error: string,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.markFailed(organizationId, id, error);
  }
}
