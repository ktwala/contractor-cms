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
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('withholding')
@Controller('withholding')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class WithholdingController {
  constructor(private readonly withholdingService: WithholdingService) {}

  @Post()
  @Permissions('withholding:create')
  @RequiresOrgContext({ type: 'body', key: 'contractorId', lookup: 'Contractor' })
  @ApiOperation({ summary: 'Create a new withholding instruction' })
  @ApiResponse({
    status: 201,
    description: 'Withholding instruction created successfully',
    type: WithholdingResponseDto,
  })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @CurrentUser('id') userId: string,
    @Body() createWithholdingDto: CreateWithholdingDto,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.create(accessContext, userId, createWithholdingDto);
  }

  @Get()
  @Permissions('withholding:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Get all withholding instructions with pagination and filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'List of withholding instructions',
    type: PaginatedWithholdingResponseDto,
  })
  async findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryWithholdingDto,
  ): Promise<PaginatedWithholdingResponseDto> {
    return this.withholdingService.findAll(accessContext, query);
  }

  @Get(':id')
  @Permissions('withholding:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'WithholdingInstruction' })
  @ApiOperation({ summary: 'Get withholding instruction by ID' })
  @ApiResponse({
    status: 200,
    description: 'Withholding instruction details',
    type: WithholdingResponseDto,
  })
  async findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.findOne(accessContext, id);
  }

  @Patch(':id')
  @Permissions('withholding:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'WithholdingInstruction' })
  @ApiOperation({ summary: 'Update withholding instruction' })
  @ApiResponse({
    status: 200,
    description: 'Withholding instruction updated successfully',
    type: WithholdingResponseDto,
  })
  async update(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() updateWithholdingDto: UpdateWithholdingDto,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.update(
      accessContext,
      id,
      updateWithholdingDto,
    );
  }

  @Delete(':id')
  @Permissions('withholding:delete')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'WithholdingInstruction' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete withholding instruction (unsynced only)' })
  @ApiResponse({
    status: 204,
    description: 'Withholding instruction deleted successfully',
  })
  async remove(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.withholdingService.remove(accessContext, id);
  }

  @Patch(':id/sync/success')
  @Permissions('withholding:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'WithholdingInstruction' })
  @ApiOperation({ summary: 'Mark withholding instruction as successfully synced' })
  @ApiResponse({
    status: 200,
    description: 'Withholding instruction marked as synced',
    type: WithholdingResponseDto,
  })
  async markSynced(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body('externalReference') externalReference: string,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.markSynced(accessContext, id, externalReference);
  }

  @Patch(':id/sync/failed')
  @Permissions('withholding:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'WithholdingInstruction' })
  @ApiOperation({ summary: 'Mark withholding instruction sync as failed' })
  @ApiResponse({
    status: 200,
    description: 'Withholding instruction marked as failed',
    type: WithholdingResponseDto,
  })
  async markFailed(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body('error') error: string,
  ): Promise<WithholdingResponseDto> {
    return this.withholdingService.markFailed(accessContext, id, error);
  }
}
