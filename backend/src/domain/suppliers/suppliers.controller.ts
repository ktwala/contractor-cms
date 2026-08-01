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
import { SuppliersService } from './suppliers.service';
import { SupplierDocumentsService } from './supplier-documents.service';
import { CreateSupplierDocumentDto } from './dto/create-supplier-document.dto';
import { UpdateSupplierDocumentDto } from './dto/update-supplier-document.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';
import { QuerySupplierApprovalQueueDto } from './dto/query-supplier-approval-queue.dto';
import {
  SupplierResponseDto,
  PaginatedSupplierResponseDto,
} from './dto/supplier-response.dto';
import { SupplierApprovalQueueResponseDto } from './dto/supplier-approval-queue.dto';
import {
  AssignSupplierPortalMembershipDto,
  SupplierPortalMembershipResponseDto,
} from './dto/assign-supplier-portal-membership.dto';
import { SupplierGovernanceDashboardDto } from './dto/supplier-governance-dashboard.dto';
import { SupplierGovernanceDashboardService } from './supplier-governance-dashboard.service';
import { SupplierOperationalTrustService } from './supplier-operational-trust.service';
import { SupplierOperationalTrustEvidenceDto } from './dto/supplier-operational-trust-evidence.dto';
import { SupplierOperationalTrustWorkforceImpactDto } from './dto/supplier-operational-trust-workforce-impact.dto';
import { SupplierOperationalTrustIntegrityReportDto } from './dto/supplier-operational-trust-integrity.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { SupplierStatusTransitionDto } from './dto/supplier-status-transition.dto';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly supplierDocumentsService: SupplierDocumentsService,
    private readonly governanceDashboard: SupplierGovernanceDashboardService,
    private readonly operationalTrustService: SupplierOperationalTrustService,
  ) {}

  @Post()
  @Permissions('suppliers:create', 'suppliers:governance-intake')
  @RequiresOrgContext({ type: 'body', key: 'organizationId' })
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({
    status: 201,
    description: 'Supplier created successfully',
    type: SupplierResponseDto,
  })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() createSupplierDto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.create(accessContext, createSupplierDto);
  }

  @Get()
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Get all suppliers with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of suppliers',
    type: PaginatedSupplierResponseDto,
  })
  async findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QuerySupplierDto,
  ): Promise<PaginatedSupplierResponseDto> {
    return this.suppliersService.findAll(accessContext, query);
  }

  @Get('approvals')
  @Permissions('suppliers:approve', 'suppliers:suspend')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Supplier approval queue (PENDING_APPROVAL)' })
  @ApiResponse({
    status: 200,
    description: 'Pending suppliers with evidence summary',
    type: SupplierApprovalQueueResponseDto,
  })
  async listApprovalQueue(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QuerySupplierApprovalQueueDto,
  ): Promise<SupplierApprovalQueueResponseDto> {
    return this.suppliersService.listApprovalQueue(accessContext, query);
  }

  @Get('governance-dashboard')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Oracle-linked supplier governance lifecycle buckets (synced / pending evidence / active / suspended)',
  })
  @ApiResponse({
    status: 200,
    description: 'Governance dashboard aggregates',
    type: SupplierGovernanceDashboardDto,
  })
  async getGovernanceDashboard(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<SupplierGovernanceDashboardDto> {
    return this.governanceDashboard.getDashboard(accessContext);
  }

  @Get('operational-trust/workforce-impact')
  @Permissions('suppliers:read', 'contractors:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Supplier Governance workforce impact — live Operational Trust findings for Workforce Discovery',
  })
  @ApiResponse({
    status: 200,
    description:
      'Suppliers whose Operational Trust state blocks discovered workers (live projection, not assessment snapshot)',
    type: SupplierOperationalTrustWorkforceImpactDto,
  })
  async getOperationalTrustWorkforceImpact(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<SupplierOperationalTrustWorkforceImpactDto> {
    return this.operationalTrustService.listWorkforceImpactFindings(accessContext);
  }

  @Get('operational-trust/integrity')
  @Permissions('suppliers:read', 'contractors:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Supplier Governance Integrity — evaluate whether Operational Trust business invariants hold',
  })
  @ApiResponse({
    status: 200,
    description:
      'Integrity PASS when all Supplier Governance invariants hold; FAIL with violation detail otherwise',
    type: SupplierOperationalTrustIntegrityReportDto,
  })
  async getOperationalTrustIntegrity(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<SupplierOperationalTrustIntegrityReportDto> {
    return this.operationalTrustService.evaluateIntegrity(accessContext);
  }

  @Get(':id/operational-trust-evidence')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Operational Trust audit evidence for a supplier' })
  @ApiResponse({
    status: 200,
    description: 'Operational Trust grant/suspend history',
    type: SupplierOperationalTrustEvidenceDto,
  })
  async getOperationalTrustEvidence(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<SupplierOperationalTrustEvidenceDto> {
    return this.operationalTrustService.getEvidence(accessContext, id);
  }

  @Get(':id')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiResponse({
    status: 200,
    description: 'Supplier details',
    type: SupplierResponseDto,
  })
  async findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.findOne(accessContext, id);
  }

  @Patch(':id')
  @Permissions('suppliers:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Update supplier' })
  @ApiResponse({
    status: 200,
    description: 'Supplier updated successfully',
    type: SupplierResponseDto,
  })
  async update(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.update(accessContext, id, updateSupplierDto);
  }

  @Delete(':id')
  @Permissions('suppliers:delete')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete supplier' })
  @ApiResponse({ status: 204, description: 'Supplier deleted successfully' })
  async remove(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.suppliersService.remove(accessContext, id);
  }

  @Get(':id/evidence-checklist')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Onboarding evidence checklist for supplier' })
  async getEvidenceChecklist(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ) {
    return this.supplierDocumentsService.getChecklist(accessContext, id);
  }

  @Get(':id/documents')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'List supplier onboarding documents (metadata)' })
  async listDocuments(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ) {
    return this.supplierDocumentsService.listDocuments(accessContext, id);
  }

  @Post(':id/documents')
  @Permissions('suppliers:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Register supplier document metadata' })
  async createDocument(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() dto: CreateSupplierDocumentDto,
  ) {
    return this.supplierDocumentsService.createDocument(accessContext, id, dto);
  }

  @Patch(':id/documents/:documentId')
  @Permissions('suppliers:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Update supplier document metadata' })
  async updateDocument(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateSupplierDocumentDto,
  ) {
    return this.supplierDocumentsService.updateDocument(
      accessContext,
      id,
      documentId,
      dto,
    );
  }

  @Patch(':id/status')
  @Permissions(
    'suppliers:submit-for-approval',
    'suppliers:approve',
    'suppliers:suspend',
    'suppliers:offboard',
    'suppliers:archive',
  )
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Governed supplier lifecycle status transition' })
  @ApiResponse({
    status: 200,
    description: 'Supplier status transitioned',
    type: SupplierResponseDto,
  })
  async transitionStatus(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() dto: SupplierStatusTransitionDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.transitionStatus(accessContext, id, dto);
  }

  @Post(':id/portal-memberships')
  @Permissions('suppliers:approve')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({
    summary: 'Assign supplier portal membership',
    description:
      'Links a user to a governed supplier for supplier-portal scope. Not created by synchronization or promotion.',
  })
  @ApiResponse({
    status: 201,
    description: 'Portal membership assigned',
    type: SupplierPortalMembershipResponseDto,
  })
  async assignPortalMembership(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() dto: AssignSupplierPortalMembershipDto,
  ): Promise<SupplierPortalMembershipResponseDto> {
    return this.suppliersService.assignPortalMembership(accessContext, id, dto);
  }
}
