import {
  Body,
  Controller,
  Get,
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
import { SupplierPortalCreateResourceDto } from './dto/supplier-portal-create-resource.dto';
import { QueryTimesheetDto } from '../timesheets/dto/query-timesheet.dto';
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

  @Get('resources')
  @Permissions('supplier-resources:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Resources (contractors) for own supplier only' })
  listResources(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.supplierPortalService.listResources(
      accessContext,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Post('resources')
  @Permissions('supplier-resources:create')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Nominate a resource for own supplier' })
  createResource(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: SupplierPortalCreateResourceDto,
  ) {
    return this.supplierPortalService.createResource(accessContext, dto);
  }

  @Get('timesheets')
  @Permissions('supplier-timesheets:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Timesheets for own supplier resources only' })
  listTimesheets(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryTimesheetDto,
  ) {
    return this.supplierPortalService.listTimesheets(accessContext, query);
  }
}
