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
import { ContractorsService } from './contractors.service';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { NominateContractorDto } from './dto/nominate-contractor.dto';
import { AcquireIndependentContractorDto } from './dto/acquire-independent-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';
import { QueryContractorDto } from './dto/query-contractor.dto';
import {
  ContractorResponseDto,
  PaginatedContractorResponseDto,
} from './dto/contractor-response.dto';
import { TransitionContractorWorkforceStateDto } from './dto/transition-contractor-workforce-state.dto';
import { QueryContractorWorkforceReviewDto } from './dto/query-contractor-workforce-review.dto';
import { ContractorWorkforceReviewQueueResponseDto } from './dto/contractor-workforce-review-queue.dto';
import { ContractorWorkforceTimelineResponseDto } from './dto/contractor-workforce-timeline.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

@ApiTags('contractors')
@Controller('contractors')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Post()
  @Permissions('contractors:create')
  @RequiresOrgContext({ type: 'body', key: 'supplierId', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Create a new contractor' })
  @ApiResponse({
    status: 201,
    description: 'Contractor created successfully',
    type: ContractorResponseDto,
  })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() createContractorDto: CreateContractorDto,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.create(accessContext, createContractorDto);
  }

  @Post('nominate')
  @Permissions('contractors:create')
  @RequiresOrgContext({ type: 'body', key: 'supplierId', lookup: 'Supplier' })
  @ApiOperation({
    summary: 'Nominate a supplier-backed contractor (workforce intake at NOMINATED)',
    description:
      'PR-WORKFORCE-NOMINATE-1 — nomination is not onboarding. Captures placement intent + sponsor basics; use workforce-transition for NOMINATED → PENDING_APPROVAL → ACTIVE.',
  })
  @ApiResponse({
    status: 201,
    description: 'Contractor nominated successfully',
    type: ContractorResponseDto,
  })
  async nominate(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() nominateContractorDto: NominateContractorDto,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.nominate(accessContext, nominateContractorDto);
  }

  @Post('acquire-independent')
  @Permissions('contractors:create')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Acquire an independent external worker (enterprise direct intake at NOMINATED)',
    description:
      'ADR-013 — Identity Acquisition independent authority. Not supplier nominate; no supplierId on worker record.',
  })
  @ApiResponse({
    status: 201,
    description: 'Independent external worker acquired at NOMINATED',
    type: ContractorResponseDto,
  })
  async acquireIndependent(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: AcquireIndependentContractorDto,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.acquireIndependent(accessContext, dto);
  }

  @Get()
  @Permissions('contractors:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Get all contractors with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of contractors',
    type: PaginatedContractorResponseDto,
  })
  async findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryContractorDto,
  ): Promise<PaginatedContractorResponseDto> {
    return this.contractorsService.findAll(accessContext, query);
  }

  @Get('workforce-review')
  @Permissions('contractors:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Internal workforce ops review queue (NOMINATED | PENDING_APPROVAL)',
    description:
      'PR-WORKFORCE-OPS-REVIEW-1 — ops review advances workforce state; not an approval workflow engine.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workforce review queue',
    type: ContractorWorkforceReviewQueueResponseDto,
  })
  async listWorkforceReviewQueue(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryContractorWorkforceReviewDto,
  ): Promise<ContractorWorkforceReviewQueueResponseDto> {
    return this.contractorsService.listWorkforceReviewQueue(accessContext, query);
  }

  @Get('workforce-rejected')
  @Permissions('contractors:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Rejected workforce nominations (reopen path — not active review queue)',
    description: 'PR-WORKFORCE-REVIEW-OUTCOMES-1',
  })
  @ApiResponse({
    status: 200,
    description: 'Rejected nominations',
    type: ContractorWorkforceReviewQueueResponseDto,
  })
  async listWorkforceRejected(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<ContractorWorkforceReviewQueueResponseDto> {
    return this.contractorsService.listWorkforceRejected(accessContext);
  }

  @Get('workforce-blacklist-eligible')
  @Permissions('contractors:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Active/terminated contractors eligible for workforce blacklist (ops-only)',
    description: 'PR-WORKFORCE-BLACKLIST-1',
  })
  @ApiResponse({
    status: 200,
    description: 'Blacklist-eligible contractors',
    type: ContractorWorkforceReviewQueueResponseDto,
  })
  async listWorkforceBlacklistEligible(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<ContractorWorkforceReviewQueueResponseDto> {
    return this.contractorsService.listWorkforceBlacklistEligible(accessContext);
  }

  @Get(':id/workforce-history')
  @Permissions('contractors:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @ApiOperation({
    summary: 'Workforce business timeline (transitions — not audit)',
    description: 'PR-WORKFORCE-TIMELINE-FOUNDATION-1 — derived labels from fromState→toState.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workforce history entries',
    type: ContractorWorkforceTimelineResponseDto,
  })
  async listWorkforceHistory(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<ContractorWorkforceTimelineResponseDto> {
    return this.contractorsService.listWorkforceTimeline(accessContext, id);
  }

  @Get(':id')
  @Permissions('contractors:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @ApiOperation({ summary: 'Get contractor by ID' })
  @ApiResponse({
    status: 200,
    description: 'Contractor details',
    type: ContractorResponseDto,
  })
  async findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.findOne(accessContext, id);
  }

  @Patch(':id')
  @Permissions('contractors:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @ApiOperation({ summary: 'Update contractor' })
  @ApiResponse({
    status: 200,
    description: 'Contractor updated successfully',
    type: ContractorResponseDto,
  })
  async update(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() updateContractorDto: UpdateContractorDto,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.update(accessContext, id, updateContractorDto);
  }

  @Delete(':id')
  @Permissions('contractors:delete')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contractor' })
  @ApiResponse({ status: 204, description: 'Contractor deleted successfully' })
  async remove(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.contractorsService.remove(accessContext, id);
  }

  @Patch(':id/workforce-transition')
  @Permissions('contractors:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @ApiOperation({
    summary: 'Apply workforce plane transition (supplier-backed; internal ops)',
    description:
      'PR-WORKFORCE-TRANSITIONS-1 — controlled workforceState change with audit + domain-event stubs. Not MTN approval workflow.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workforce state updated',
    type: ContractorResponseDto,
  })
  async transitionWorkforceState(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() dto: TransitionContractorWorkforceStateDto,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.transitionWorkforceState(
      accessContext,
      id,
      dto.targetState,
      dto.reason,
      dto.authorityNote,
    );
  }

  @Patch(':id/deactivate')
  @Permissions('contractors:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @ApiOperation({ summary: 'Deactivate contractor' })
  @ApiResponse({
    status: 200,
    description: 'Contractor deactivated',
    type: ContractorResponseDto,
  })
  async deactivate(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.deactivate(accessContext, id);
  }
}
