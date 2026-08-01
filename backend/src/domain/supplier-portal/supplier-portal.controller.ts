import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { SupplierPortalUpdateProfileDto } from './dto/supplier-portal-update-profile.dto';
import { SupplierPortalCreateContractorDto } from './dto/supplier-portal-create-contractor.dto';
import { QueryTimesheetDto } from '../timesheets/dto/query-timesheet.dto';
import { QuerySupplierPortalInvoicesDto } from './dto/query-supplier-portal-invoices.dto';
import { CreateSupplierDocumentDto } from '../suppliers/dto/create-supplier-document.dto';
import {
  PERMISSIONS,
  SUPPLIER_PORTAL_CONTRACTOR_PERMISSIONS,
} from '../../core/auth/permissions.constants';
import { SupplierPortalService } from './supplier-portal.service';
import { SupplierPortalScopeGuard } from './guards/supplier-portal-scope.guard';

@ApiTags('supplier-portal')
@Controller('supplier-portal')
@UseGuards(JwtAuthGuard, PermissionsGuard, SupplierPortalScopeGuard)
@ApiBearerAuth()
export class SupplierPortalController {
  constructor(private readonly supplierPortalService: SupplierPortalService) {}

  @Get('profile')
  @Permissions('supplier-profile:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Own supplier profile (membership-scoped)' })
  getProfile(@CurrentAccessContext() accessContext: AccessContext) {
    return this.supplierPortalService.getProfile(accessContext);
  }

  @Patch('profile')
  @Permissions('supplier-profile:update')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Update own supplier profile' })
  updateProfile(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: SupplierPortalUpdateProfileDto,
  ) {
    return this.supplierPortalService.updateProfile(accessContext, dto);
  }

  @Get('evidence-checklist')
  @Permissions(PERMISSIONS.SUPPLIER_ONBOARDING.READ)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Jurisdiction onboarding evidence checklist (own supplier)' })
  getEvidenceChecklist(@CurrentAccessContext() accessContext: AccessContext) {
    return this.supplierPortalService.getEvidenceChecklist(accessContext);
  }

  @Get('documents')
  @Permissions(PERMISSIONS.SUPPLIER_DOCUMENTS.READ)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'List own supplier onboarding documents (metadata)' })
  listDocuments(@CurrentAccessContext() accessContext: AccessContext) {
    return this.supplierPortalService.listDocuments(accessContext);
  }

  @Post('documents')
  @Permissions(PERMISSIONS.SUPPLIER_DOCUMENTS.MANAGE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Register onboarding document metadata for own supplier' })
  createDocument(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: CreateSupplierDocumentDto,
  ) {
    return this.supplierPortalService.createDocument(accessContext, dto);
  }

  @Post('submit-for-approval')
  @Permissions(PERMISSIONS.SUPPLIER_ONBOARDING.SUBMIT)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Submit supplier for operations approval when evidence is complete (cannot self-approve)',
  })
  submitForApproval(@CurrentAccessContext() accessContext: AccessContext) {
    return this.supplierPortalService.submitForApproval(accessContext);
  }

  @Get('contracts')
  @Permissions(...SUPPLIER_PORTAL_CONTRACTOR_PERMISSIONS.READ)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Active supplier contracts for nomination placement intent' })
  listContracts(@CurrentAccessContext() accessContext: AccessContext) {
    return this.supplierPortalService.listContracts(accessContext);
  }

  @Get('contractors')
  @Permissions(...SUPPLIER_PORTAL_CONTRACTOR_PERMISSIONS.READ)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Supplier-scoped contractors (membership-bound)' })
  listContractors(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.supplierPortalService.listContractors(
      accessContext,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('contractors/:id/workforce-history')
  @Permissions(...SUPPLIER_PORTAL_CONTRACTOR_PERMISSIONS.READ)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Supplier-scoped workforce timeline (read-only business narrative)',
    description:
      'PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1 — suppliers may view workforce history for their workers; they may not advance workforce state.',
  })
  getContractorWorkforceHistory(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ) {
    return this.supplierPortalService.getContractorWorkforceHistory(accessContext, id);
  }

  @Get('contractors/:id')
  @Permissions(...SUPPLIER_PORTAL_CONTRACTOR_PERMISSIONS.READ)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Supplier-scoped contractor detail (read-only)' })
  getContractor(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ) {
    return this.supplierPortalService.getContractor(accessContext, id);
  }

  @Post('contractors')
  @Permissions(...SUPPLIER_PORTAL_CONTRACTOR_PERMISSIONS.CREATE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Nominate a supplier-scoped contractor (workforce intake at NOMINATED)',
    description:
      'PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1 — supplier portal can nominate; it cannot activate.',
  })
  createContractor(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: SupplierPortalCreateContractorDto,
  ) {
    return this.supplierPortalService.createContractor(accessContext, dto);
  }

  @Get('timesheets')
  @Permissions('supplier-timesheets:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Timesheets for own supplier contractors only' })
  listTimesheets(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryTimesheetDto,
  ) {
    return this.supplierPortalService.listTimesheets(accessContext, query);
  }

  @Get('invoices')
  @Permissions(PERMISSIONS.SUPPLIER_INVOICES.READ)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Read-only invoices for active supplier membership (no supplierId parameter; amounts redacted without finance grants)',
  })
  listInvoices(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QuerySupplierPortalInvoicesDto,
  ) {
    return this.supplierPortalService.listInvoices(accessContext, query);
  }

  @Get('dashboard')
  @Permissions(
    'supplier-profile:read',
    'supplier-contractors:read',
    'supplier-timesheets:read',
  )
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Supplier portal dashboard aggregates (membership-scoped)',
  })
  getDashboard(@CurrentAccessContext() accessContext: AccessContext) {
    return this.supplierPortalService.getDashboard(accessContext);
  }
}
