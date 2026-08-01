import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { DataImportsService } from './data-imports.service';
import { ImportPipelineService } from './import-pipeline.service';
import { CreateImportJobDto } from './dto/create-import-job.dto';
import { ListImportJobsDto } from './dto/list-import-jobs.dto';
import { ListImportRowsDto } from './dto/list-import-rows.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnyPermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('api/enterprise/data-imports')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class DataImportsController {
  constructor(
    private readonly service: DataImportsService,
    private readonly pipeline: ImportPipelineService,
  ) {}

  @Post()
  @AnyPermissions('data_import:write', 'iam:legal_entities:manage')
  create(
    @Body() dto: CreateImportJobDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.createJob(dto, userId);
  }

  @Post('upload')
  @AnyPermissions('data_import:write', 'iam:legal_entities:manage')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('dataset_type') datasetType: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }
    if (!datasetType) {
      throw new BadRequestException('dataset_type is required');
    }
    return this.service.uploadAndParse(
      datasetType as any,
      file.originalname,
      file.buffer,
      userId,
    );
  }

  @Get('wizard/prerequisites')
  @AnyPermissions('data_import:read', 'data_import:write', 'data_import:approve', 'data_import:publish', 'iam:legal_entities:manage')
  getWizardPrerequisites(
    @Query('dataset') dataset: string,
  ) {
    return this.service.getWizardPrerequisites(dataset);
  }

  @Get()
  @AnyPermissions('data_import:read', 'iam:legal_entities:manage')
  list(
    @Query() query: ListImportJobsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.listJobs(query, userId);
  }

  @Get(':jobId/export-errors')
  @AnyPermissions('data_import:read', 'iam:legal_entities:manage')
  async exportErrors(
    @Param('jobId') jobId: string,
    @Query('format') format: string,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
  ) {
    const fmt = (format ?? 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
    const buffer = await this.service.exportValidationErrors(jobId, userId, fmt);
    const filename = `validation-errors-${jobId}.${fmt}`;
    res.setHeader('Content-Type', fmt === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':jobId/export-validation-report')
  @AnyPermissions('data_import:read', 'iam:legal_entities:manage')
  async exportValidationReport(
    @Param('jobId') jobId: string,
    @Query('format') format: string,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
  ) {
    const fmt = (format ?? 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
    const buffer = await this.service.exportValidationReport(jobId, userId, fmt);
    const filename = `validation-report-${jobId}.${fmt}`;
    res.setHeader('Content-Type', fmt === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':jobId')
  @AnyPermissions('data_import:read', 'iam:legal_entities:manage')
  getOne(
    @Param('jobId') jobId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.getJob(jobId, userId);
  }

  @Get(':jobId/rows')
  @AnyPermissions('data_import:read', 'iam:legal_entities:manage')
  listRows(
    @Param('jobId') jobId: string,
    @Query() query: ListImportRowsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.listRows(jobId, query, userId);
  }

  @Get(':jobId/status')
  @AnyPermissions('data_import:read', 'data_import:write', 'iam:legal_entities:manage')
  getStatus(@Param('jobId') jobId: string) {
    return this.pipeline.getJobStatus(jobId);
  }

  @Post(':jobId/validate')
  @AnyPermissions('data_import:write', 'iam:legal_entities:manage')
  validate(
    @Param('jobId') jobId: string,
    @Query('mode') mode: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (mode === 'pipeline') {
      return this.pipeline.enqueueValidation(jobId);
    }
    return this.service.validateJob(jobId, userId);
  }

  @Post(':jobId/approve')
  @AnyPermissions('data_import:approve', 'iam:legal_entities:manage')
  approve(
    @Param('jobId') jobId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.approveJob(jobId, userId);
  }

  @Post(':jobId/publish')
  @AnyPermissions('data_import:publish', 'iam:legal_entities:manage')
  publish(
    @Param('jobId') jobId: string,
    @Query('mode') mode: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (mode === 'pipeline') {
      return this.pipeline.enqueuePublish(jobId);
    }
    return this.service.publishJob(jobId, userId);
  }

  @Post(':jobId/cancel')
  @AnyPermissions('data_import:write', 'iam:legal_entities:manage')
  cancel(
    @Param('jobId') jobId: string,
    @Body('reason') reason: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.pipeline.cancelJob(jobId, userId, reason);
  }

  @Post(':jobId/retry')
  @AnyPermissions('data_import:write', 'iam:legal_entities:manage')
  retry(
    @Param('jobId') jobId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.pipeline.retryJob(jobId, userId);
  }

  @Delete(':jobId')
  @AnyPermissions('data_import:write', 'iam:legal_entities:manage')
  remove(
    @Param('jobId') jobId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.deleteJob(jobId, userId);
  }
}
