import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { PERMISSIONS } from '../../core/auth/permissions.constants';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { IngestFileBatchDto } from './dto/ingest-file-batch.dto';
import { IngestOracleRestBatchDto } from './dto/ingest-oracle-rest-batch.dto';
import { ListBatchRowsDto } from './dto/list-batch-rows.dto';
import { ListMigrationBatchesDto } from './dto/list-migration-batches.dto';
import { PromoteBatchDto } from './dto/promote-batch.dto';
import { HcmMigrationAdminService } from './services/hcm-migration-admin.service';
import { resolveMigrationOrganizationId } from './utils/migration-org-context.util';

/**
 * PR-CTR-6 — contractor migration control plane (staging-only ingest; promote via service).
 */
@ApiTags('contractor-migration-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequiresOrgContext({ type: 'currentUser' })
@Controller('admin/contractor-migration')
export class ContractorMigrationAdminController {
  constructor(private readonly admin: HcmMigrationAdminService) {}

  @Post('batches/file')
  @Permissions(PERMISSIONS.CONTRACTORS.BOOTSTRAP)
  @ApiOperation({ summary: 'Ingest HCM contractor extract file into staging' })
  @ApiResponse({ status: 201, description: 'Batch ingest summary' })
  ingestFile(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: IngestFileBatchDto,
  ) {
    const organizationId = resolveMigrationOrganizationId(
      accessContext,
      dto.organizationId,
    );
    return this.admin.ingestFile(accessContext, organizationId, dto);
  }

  @Post('batches/oracle-rest')
  @Permissions(PERMISSIONS.CONTRACTORS.BOOTSTRAP)
  @ApiOperation({
    summary: 'Ingest contractors from Oracle HCM REST into staging (no promote/IGA)',
  })
  ingestOracleRest(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: IngestOracleRestBatchDto,
  ) {
    const organizationId = resolveMigrationOrganizationId(
      accessContext,
      dto.organizationId,
    );
    return this.admin.ingestOracleRest(accessContext, organizationId, dto);
  }

  @Get('batches')
  @Permissions(PERMISSIONS.CONTRACTOR_MIGRATION.READ)
  @ApiOperation({ summary: 'List migration batches for the current organization' })
  listBatches(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: ListMigrationBatchesDto,
  ) {
    const organizationId = resolveMigrationOrganizationId(
      accessContext,
      query.organizationId,
    );
    return this.admin.listBatches(organizationId, query);
  }

  @Get('batches/:id')
  @Permissions(PERMISSIONS.CONTRACTOR_MIGRATION.READ)
  @ApiOperation({ summary: 'Get migration batch detail and staging counts' })
  getBatch(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') batchId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const orgId = resolveMigrationOrganizationId(accessContext, organizationId);
    return this.admin.getBatch(orgId, batchId);
  }

  @Get('batches/:id/staging')
  @Permissions(PERMISSIONS.CONTRACTOR_MIGRATION.READ)
  @ApiOperation({ summary: 'List staging rows for a migration batch' })
  listStaging(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') batchId: string,
    @Query() query: ListBatchRowsDto,
  ) {
    const organizationId = resolveMigrationOrganizationId(
      accessContext,
      query.organizationId,
    );
    return this.admin.listStaging(organizationId, batchId, query);
  }

  @Get('batches/:id/quarantine')
  @Permissions(PERMISSIONS.CONTRACTOR_MIGRATION.READ)
  @ApiOperation({ summary: 'List quarantined rows for a migration batch' })
  listQuarantine(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') batchId: string,
    @Query() query: ListBatchRowsDto,
  ) {
    const organizationId = resolveMigrationOrganizationId(
      accessContext,
      query.organizationId,
    );
    return this.admin.listQuarantine(organizationId, batchId, query);
  }

  @Post('batches/:id/validate')
  @Permissions(PERMISSIONS.CONTRACTORS.BOOTSTRAP)
  @ApiOperation({ summary: 'Validate all non-promoted staging rows in a batch' })
  validateBatch(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') batchId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const orgId = resolveMigrationOrganizationId(accessContext, organizationId);
    return this.admin.validateBatch(orgId, batchId);
  }

  @Post('batches/:id/promote')
  @Permissions(PERMISSIONS.CONTRACTORS.BOOTSTRAP)
  @ApiOperation({
    summary: 'Promote PASSED staging rows to the operational workforce (controlled path only)',
  })
  promoteBatch(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') batchId: string,
    @Body() dto: PromoteBatchDto,
    @Query('organizationId') organizationId?: string,
  ) {
    const orgId = resolveMigrationOrganizationId(accessContext, organizationId);
    return this.admin.promoteBatch(orgId, batchId, dto);
  }
}
