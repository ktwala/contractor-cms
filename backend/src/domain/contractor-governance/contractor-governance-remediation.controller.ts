import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { PERMISSIONS } from '../../core/auth/permissions.constants';
import { ContractorGovernanceRemediationService } from './contractor-governance-remediation.service';
import {
  AssignContractorGovernanceRemediationDto,
  CloseContractorGovernanceRemediationDto,
  ContractorGovernanceRemediationItemDto,
  ContractorGovernanceRemediationSummaryDto,
  CreateContractorGovernanceRemediationDto,
  PaginatedContractorGovernanceRemediationDto,
  QueryContractorGovernanceRemediationDto,
  VerifyContractorGovernanceRemediationDto,
} from './dto/contractor-governance-remediation.dto';

@ApiTags('contractor-governance')
@Controller('contractor-governance/remediation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ContractorGovernanceRemediationController {
  constructor(private readonly remediationService: ContractorGovernanceRemediationService) {}

  @Post('create')
  @Permissions(PERMISSIONS.CONTRACTOR_REMEDIATION.MANAGE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Create remediation from drift (no auto-mutation)' })
  @ApiResponse({ status: 201, type: ContractorGovernanceRemediationItemDto })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: CreateContractorGovernanceRemediationDto,
  ): Promise<ContractorGovernanceRemediationItemDto> {
    return this.remediationService.create(accessContext, dto);
  }

  @Get()
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'List governance remediations' })
  @ApiResponse({ status: 200, type: PaginatedContractorGovernanceRemediationDto })
  async list(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryContractorGovernanceRemediationDto,
  ): Promise<PaginatedContractorGovernanceRemediationDto> {
    return this.remediationService.list(accessContext, query);
  }

  @Get('summary')
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Remediation summary for operations dashboard' })
  @ApiResponse({ status: 200, type: ContractorGovernanceRemediationSummaryDto })
  async summary(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<ContractorGovernanceRemediationSummaryDto> {
    return this.remediationService.getSummary(accessContext);
  }

  @Post(':id/acknowledge')
  @Permissions(PERMISSIONS.CONTRACTOR_REMEDIATION.MANAGE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiResponse({ status: 200, type: ContractorGovernanceRemediationItemDto })
  async acknowledge(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() dto: AssignContractorGovernanceRemediationDto,
  ): Promise<ContractorGovernanceRemediationItemDto> {
    return this.remediationService.acknowledge(accessContext, id, dto.assignedToUserId);
  }

  @Post(':id/verify')
  @Permissions(PERMISSIONS.CONTRACTOR_REMEDIATION.MANAGE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiResponse({ status: 200, type: ContractorGovernanceRemediationItemDto })
  async verify(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() dto: VerifyContractorGovernanceRemediationDto,
  ): Promise<ContractorGovernanceRemediationItemDto> {
    return this.remediationService.verify(accessContext, id, dto.notes);
  }

  @Post(':id/close')
  @Permissions(PERMISSIONS.CONTRACTOR_REMEDIATION.MANAGE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiResponse({ status: 200, type: ContractorGovernanceRemediationItemDto })
  async close(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() dto: CloseContractorGovernanceRemediationDto,
  ): Promise<ContractorGovernanceRemediationItemDto> {
    return this.remediationService.close(accessContext, id, dto);
  }
}
