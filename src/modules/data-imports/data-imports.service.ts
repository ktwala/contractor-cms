import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/database/prisma.service';
import { OrgUnitManagerInferenceService } from '../org-unit-manager-inference/org-unit-manager-inference.service';
import {
  DataImportDatasetType,
  DataImportRowStatus,
  DataImportStatus,
} from '@prisma/client';
import { CreateImportJobDto } from './dto/create-import-job.dto';
import { ListImportJobsDto } from './dto/list-import-jobs.dto';
import { ListImportRowsDto } from './dto/list-import-rows.dto';
import { parseImportFile } from './utils/file-parser';
import {
  dbValidationErrorToGroupedRow,
  groupedErrorsToCsv,
  GroupedExportErrorRow,
  legacySheetFromFieldName,
  validationReportToXlsx,
  validationWorkbookToXlsx,
  ValidationSummary,
} from './utils/export-errors';
import { LegalEntitiesValidator } from './validators/legal-entities.validator';
import { OrgUnitsValidator } from './validators/org-units.validator';
import { CostCentersValidator } from './validators/cost-centers.validator';
import { EmployeesValidator } from './validators/employees.validator';
import { EmploymentsValidator } from './validators/employments.validator';
import { EmploymentAssignmentsValidator } from './validators/employment-assignments.validator';
import { EmployeeManagersValidator } from './validators/employee-managers.validator';
import { PayGroupsValidator } from './validators/pay-groups.validator';
import { PositionsValidator } from './validators/positions.validator';
import { LegalEntitiesPublisher } from './publishers/legal-entities.publisher';
import { OrgUnitsPublisher } from './publishers/org-units.publisher';
import { CostCentersPublisher } from './publishers/cost-centers.publisher';
import { EmployeesPublisher } from './publishers/employees.publisher';
import { EmploymentsPublisher } from './publishers/employments.publisher';
import { EmploymentAssignmentsPublisher } from './publishers/employment-assignments.publisher';
import { EmployeeManagersPublisher } from './publishers/employee-managers.publisher';
import { PayGroupsPublisher } from './publishers/pay-groups.publisher';
import { PositionsPublisher } from './publishers/positions.publisher';

const TENANT_ID = 'default';

@Injectable()
export class DataImportsService {
  private readonly logger = new Logger(DataImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() @Inject(OrgUnitManagerInferenceService)
    private readonly inferenceService: OrgUnitManagerInferenceService | undefined,
    private readonly legalEntitiesValidator: LegalEntitiesValidator,
    private readonly orgUnitsValidator: OrgUnitsValidator,
    private readonly costCentersValidator: CostCentersValidator,
    private readonly employeesValidator: EmployeesValidator,
    private readonly employmentsValidator: EmploymentsValidator,
    private readonly employmentAssignmentsValidator: EmploymentAssignmentsValidator,
    private readonly employeeManagersValidator: EmployeeManagersValidator,
    private readonly payGroupsValidator: PayGroupsValidator,
    private readonly positionsValidator: PositionsValidator,
    private readonly legalEntitiesPublisher: LegalEntitiesPublisher,
    private readonly orgUnitsPublisher: OrgUnitsPublisher,
    private readonly costCentersPublisher: CostCentersPublisher,
    private readonly employeesPublisher: EmployeesPublisher,
    private readonly employmentsPublisher: EmploymentsPublisher,
    private readonly employmentAssignmentsPublisher: EmploymentAssignmentsPublisher,
    private readonly employeeManagersPublisher: EmployeeManagersPublisher,
    private readonly payGroupsPublisher: PayGroupsPublisher,
    private readonly positionsPublisher: PositionsPublisher,
  ) {}

  async createJob(
    dto: CreateImportJobDto,
    userId: string,
  ) {
    const job = await this.prisma.dataImportJob.create({
      data: {
        tenantId: TENANT_ID,
        datasetType: dto.dataset_type,
        fileName: dto.file_name,
        fileStoragePath: dto.file_storage_path ?? null,
        uploadedByUserId: userId,
        status: 'UPLOADED',
      },
    });
    await this.auditService.log({
      userId,
      action: 'DATA_IMPORT_JOB_CREATED',
      entityType: 'DataImportJob',
      entityId: job.id,
      newValue: { datasetType: dto.dataset_type, fileName: dto.file_name },
    });
    return job;
  }

  async uploadAndParse(
    datasetType: DataImportDatasetType,
    fileName: string,
    buffer: Buffer,
    userId: string,
  ) {
    const rows = parseImportFile(buffer, fileName);
    if (rows.length === 0) {
      throw new BadRequestException('File contains no data rows');
    }

    const job = await this.prisma.dataImportJob.create({
      data: {
        tenantId: TENANT_ID,
        datasetType,
        fileName,
        uploadedByUserId: userId,
        status: 'UPLOADED',
        rowsTotal: rows.length,
      },
    });

    await this.ingestRows(job.id, rows);
    await this.auditService.log({
      userId,
      action: 'DATA_IMPORT_JOB_CREATED',
      entityType: 'DataImportJob',
      entityId: job.id,
      newValue: {
        datasetType,
        fileName,
        rowCount: rows.length,
      },
    });
    const fullJob = await this.getJob(job.id, userId);
    return { ...fullJob, rowCount: rows.length };
  }

  private async ingestRows(jobId: string, rows: Record<string, unknown>[]) {
    await this.prisma.dataImportRow.createMany({
      data: rows.map((row, index) => ({
        jobId,
        rowNumber: index + 1,
        sheetName: 'data',
        sheetRowNumber: index + 2,
        externalKey:
          (row.employee_no as string) ??
          (row.code as string) ??
          (row.org_unit_code as string) ??
          (row.cost_center_code as string) ??
          (row.position_code as string) ??
          null,
        payloadJson: row as object,
        status: 'PENDING',
      })),
    });

    await this.prisma.dataImportJob.update({
      where: { id: jobId },
      data: { status: 'PARSED' },
    });
  }

  async getWizardPrerequisites(dataset: string): Promise<{
    dataset: string;
    ready: boolean;
    checks: Array<{ key: string; label: string; ready: boolean; count: number; href: string }>;
  }> {
    const ds = (dataset ?? '').toUpperCase();
    if (ds === 'EMPLOYEES') {
      const legalEntities = await this.prisma.legalEntity.count();
      return {
        dataset: 'EMPLOYEES',
        ready: true,
        checks: [
          {
            key: 'legal_entities',
            label: 'Legal Entities',
            ready: legalEntities > 0,
            count: legalEntities,
            href: '/enterprise/legal-entities',
          },
        ],
      };
    }
    if (ds === 'EMPLOYMENTS') {
      const [employeeCount, legalEntityCount, payGroupCount] = await Promise.all([
        this.prisma.employee.count(),
        this.prisma.legalEntity.count(),
        this.prisma.payGroup.count(),
      ]);
      const checks = [
        { key: 'employees', label: 'Employees', ready: employeeCount > 0, count: employeeCount, href: '/enterprise/employees' },
        { key: 'legal_entities', label: 'Legal Entities', ready: legalEntityCount > 0, count: legalEntityCount, href: '/enterprise/legal-entities' },
        { key: 'pay_groups', label: 'Pay Groups', ready: payGroupCount > 0, count: payGroupCount, href: '/enterprise/legal-entities' },
      ];
      return {
        dataset: 'EMPLOYMENTS',
        ready: checks.every((c) => c.ready),
        checks,
      };
    }
    if (ds === 'MANAGER_RELATIONSHIPS' || ds === 'EMPLOYEE_MANAGERS') {
      const [employeeCount, employmentCount, orgUnitCount] = await Promise.all([
        this.prisma.employee.count(),
        this.prisma.employment.count(),
        this.prisma.orgUnit.count(),
      ]);
      const checks = [
        { key: 'employees', label: 'Employees', ready: employeeCount > 0, count: employeeCount, href: '/enterprise/employees' },
        { key: 'employments', label: 'Employments', ready: employmentCount > 0, count: employmentCount, href: '/enterprise/employees' },
        { key: 'org_units', label: 'Org Units', ready: orgUnitCount > 0, count: orgUnitCount, href: '/enterprise/org-structure' },
      ];
      return {
        dataset: 'MANAGER_RELATIONSHIPS',
        ready: checks[0].ready,
        checks,
      };
    }
    return {
      dataset: ds || 'UNKNOWN',
      ready: true,
      checks: [],
    };
  }

  async listJobs(query: ListImportJobsDto, userId: string) {
    const where: Record<string, unknown> = { uploadedByUserId: userId };
    if (query.dataset_type) where.datasetType = query.dataset_type;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.dataImportJob.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      }),
      this.prisma.dataImportJob.count({ where }),
    ]);

    return { items, total };
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.dataImportJob.findFirst({
      where: { id: jobId, uploadedByUserId: userId },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    return job;
  }

  async listRows(
    jobId: string,
    query: ListImportRowsDto,
    userId: string,
  ) {
    const job = await this.getJob(jobId, userId);

    const where: Record<string, unknown> = { jobId };
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.dataImportRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        take: query.limit ?? 100,
        skip: query.offset ?? 0,
        include: { errors: true },
      }),
      this.prisma.dataImportRow.count({ where }),
    ]);

    return { items, total };
  }

  async validateJob(jobId: string, userId: string) {
    const job = await this.prisma.dataImportJob.findFirst({
      where: { id: jobId, uploadedByUserId: userId },
      include: {
        rows: {
          select: { id: true, rowNumber: true, payloadJson: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    if (job.status === 'PUBLISHED') {
      throw new BadRequestException('Published jobs cannot be revalidated');
    }

    const isPipelineCall = job.status === 'VALIDATING';
    if (!isPipelineCall) {
      await this.prisma.dataImportError.deleteMany({ where: { jobId } });
    }

    const jobWithRows = {
      id: job.id,
      rows: job.rows ?? [],
    };

    let result: Record<string, number>;
    switch (job.datasetType) {
      case 'LEGAL_ENTITIES':
        result = await this.legalEntitiesValidator.validate(jobWithRows);
        break;
      case 'ORG_UNITS':
        result = await this.orgUnitsValidator.validate(jobWithRows);
        break;
      case 'COST_CENTERS':
        result = await this.costCentersValidator.validate(jobWithRows);
        break;
      case 'EMPLOYEES':
        result = await this.employeesValidator.validate(jobWithRows);
        break;
      case 'EMPLOYMENTS':
        result = await this.employmentsValidator.validate(jobWithRows);
        break;
      case 'EMPLOYMENT_ASSIGNMENTS':
        result = await this.employmentAssignmentsValidator.validate(jobWithRows);
        break;
      case 'MANAGER_RELATIONSHIPS':
        result = await this.employeeManagersValidator.validate(jobWithRows);
        break;
      case 'PAY_GROUPS':
        result = await this.payGroupsValidator.validate(jobWithRows);
        break;
      case 'POSITIONS':
        result = await this.positionsValidator.validate(jobWithRows);
        break;
      default:
        throw new BadRequestException(
          `Unsupported dataset type: ${job.datasetType}`,
        );
    }
    await this.auditService.log({
      userId,
      action: 'DATA_IMPORT_JOB_VALIDATED',
      entityType: 'DataImportJob',
      entityId: job.id,
      newValue: { datasetType: job.datasetType, ...result },
    });
    return result;
  }

  async approveJob(jobId: string, userId: string) {
    const job = await this.prisma.dataImportJob.findFirst({
      where: { id: jobId, uploadedByUserId: userId },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    const summary = (job.summaryJson as Record<string, number>) ?? {};
    if (job.status !== 'VALIDATED') {
      throw new BadRequestException('Job must be validated before approval');
    }
    if ((summary.errors ?? 0) > 0) {
      throw new BadRequestException(
        'Job has validation errors and cannot be approved',
      );
    }

    const updated = await this.prisma.dataImportJob.update({
      where: { id: jobId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByUserId: userId,
      },
    });
    await this.auditService.log({
      userId,
      action: 'DATA_IMPORT_JOB_APPROVED',
      entityType: 'DataImportJob',
      entityId: jobId,
      newValue: { datasetType: job.datasetType, fileName: job.fileName },
    });
    return updated;
  }

  async publishJob(jobId: string, userId: string) {
    const job = await this.prisma.dataImportJob.findFirst({
      where: { id: jobId, uploadedByUserId: userId },
      include: { rows: true },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    if (job.status !== 'APPROVED') {
      throw new BadRequestException('Job must be approved before publishing');
    }

    await this.assertPublishDependencies(job);

    const user = { id: userId };

    let result;
    switch (job.datasetType) {
      case 'LEGAL_ENTITIES':
        result = await this.legalEntitiesPublisher.publish(job, user);
        break;
      case 'ORG_UNITS':
        result = await this.orgUnitsPublisher.publish(job, user);
        break;
      case 'COST_CENTERS':
        result = await this.costCentersPublisher.publish(job, user);
        break;
      case 'EMPLOYEES':
        result = await this.employeesPublisher.publish(job, user);
        break;
      case 'EMPLOYMENTS':
        result = await this.employmentsPublisher.publish(job, user);
        break;
      case 'EMPLOYMENT_ASSIGNMENTS':
        result = await this.employmentAssignmentsPublisher.publish(job, user);
        break;
      case 'MANAGER_RELATIONSHIPS':
        result = await this.employeeManagersPublisher.publish(job, user);
        break;
      case 'PAY_GROUPS':
        result = await this.payGroupsPublisher.publish(job, user);
        break;
      case 'POSITIONS':
        result = await this.positionsPublisher.publish(job, user);
        break;
      default:
        throw new BadRequestException(
          `Unsupported dataset type: ${job.datasetType}`,
        );
    }
    await this.auditService.log({
      userId,
      action: 'DATA_IMPORT_JOB_PUBLISHED',
      entityType: 'DataImportJob',
      entityId: job.id,
      newValue: {
        datasetType: job.datasetType,
        publishSummary: (result as { publishSummaryJson?: object })?.publishSummaryJson ?? result,
      },
    });
    return result;
  }

  private async assertPublishDependencies(job: {
    tenantId: string;
    datasetType: DataImportDatasetType;
  }) {
    const hasPublished = async (datasetType: DataImportDatasetType) => {
      const count = await this.prisma.dataImportJob.count({
        where: {
          tenantId: job.tenantId,
          datasetType,
          status: 'PUBLISHED',
        },
      });
      return count > 0;
    };

    switch (job.datasetType) {
      case 'ORG_UNITS':
        if (!(await hasPublished('LEGAL_ENTITIES'))) {
          throw new BadRequestException(
            'LEGAL_ENTITIES must be published before ORG_UNITS',
          );
        }
        break;
      case 'PAY_GROUPS':
        if (!(await hasPublished('LEGAL_ENTITIES'))) {
          throw new BadRequestException(
            'LEGAL_ENTITIES must be published before PAY_GROUPS',
          );
        }
        break;
      case 'POSITIONS':
        if (!(await hasPublished('LEGAL_ENTITIES'))) {
          throw new BadRequestException(
            'LEGAL_ENTITIES must be published before POSITIONS',
          );
        }
        if (!(await hasPublished('ORG_UNITS'))) {
          throw new BadRequestException(
            'ORG_UNITS must be published before POSITIONS',
          );
        }
        break;
      case 'EMPLOYMENTS':
        if (!(await hasPublished('LEGAL_ENTITIES'))) {
          throw new BadRequestException(
            'LEGAL_ENTITIES must be published before EMPLOYMENTS',
          );
        }
        if (!(await hasPublished('EMPLOYEES'))) {
          throw new BadRequestException(
            'EMPLOYEES must be published before EMPLOYMENTS',
          );
        }
        break;
      case 'EMPLOYMENT_ASSIGNMENTS':
        if (!(await hasPublished('ORG_UNITS'))) {
          throw new BadRequestException(
            'ORG_UNITS must be published before EMPLOYMENT_ASSIGNMENTS',
          );
        }
        if (!(await hasPublished('EMPLOYMENTS'))) {
          throw new BadRequestException(
            'EMPLOYMENTS must be published before EMPLOYMENT_ASSIGNMENTS',
          );
        }
        break;
      case 'MANAGER_RELATIONSHIPS':
        if (!(await hasPublished('EMPLOYEES'))) {
          throw new BadRequestException(
            'EMPLOYEES must be published before MANAGER_RELATIONSHIPS',
          );
        }
        break;
    }
  }

  // ─── Pipeline-internal methods (called by ImportPipelineService) ──

  /**
   * Validate a chunk of rows through the appropriate validator.
   * Called by the pipeline worker. Does NOT finalize the job.
   */
  async validateChunk(
    jobId: string,
    datasetType: DataImportDatasetType,
    rows: Array<{ id: string; rowNumber: number; payloadJson: unknown }>,
  ): Promise<{ valid: number; invalid: number; warnings: number; errors: number }> {
    const validator = this.getValidator(datasetType);

    const fakeJob = { id: jobId, rows };
    const result = await validator.validate(fakeJob);

    return {
      valid: (result as Record<string, number>).valid_rows ?? 0,
      invalid: (result as Record<string, number>).invalid_rows ?? 0,
      warnings: (result as Record<string, number>).warnings ?? 0,
      errors: (result as Record<string, number>).errors ?? 0,
    };
  }

  /**
   * Run the publisher for a job. Called by the pipeline worker.
   * Skips auth checks — the pipeline is already authorized.
   */
  async publishJobInternal(job: {
    id: string;
    datasetType: DataImportDatasetType;
    tenantId: string;
    rows: Array<{ id: string; rowNumber: number; payloadJson: unknown; status: string; mappedJson: unknown }>;
    uploadedByUserId: string;
  }) {
    await this.assertPublishDependencies(job);

    const user = { id: job.uploadedByUserId };
    const publisher = this.getPublisher(job.datasetType);
    const result = await publisher.publish(job as any, user);

    await this.prisma.dataImportJob.update({
      where: { id: job.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedByUserId: job.uploadedByUserId,
        publishSummaryJson: (result as { publishSummaryJson?: object })?.publishSummaryJson ?? (result as object),
      },
    });

    await this.auditService.log({
      userId: job.uploadedByUserId,
      action: 'DATA_IMPORT_JOB_PUBLISHED',
      entityType: 'DataImportJob',
      entityId: job.id,
      newValue: {
        datasetType: job.datasetType,
        publishSummary: (result as { publishSummaryJson?: object })?.publishSummaryJson ?? result,
        source: 'pipeline',
      },
    });

    const triggerTypes: DataImportDatasetType[] = ['ORG_UNITS', 'EMPLOYEES', 'EMPLOYMENTS', 'EMPLOYMENT_ASSIGNMENTS', 'MANAGER_RELATIONSHIPS'];
    if (this.inferenceService && triggerTypes.includes(job.datasetType)) {
      this.inferenceService.generateSuggestions().catch((err) => {
        this.logger.warn(`Post-publish suggestion generation failed: ${err.message}`);
      });
    }

    return result;
  }

  private getValidator(datasetType: DataImportDatasetType) {
    switch (datasetType) {
      case 'LEGAL_ENTITIES': return this.legalEntitiesValidator;
      case 'ORG_UNITS': return this.orgUnitsValidator;
      case 'COST_CENTERS': return this.costCentersValidator;
      case 'EMPLOYEES': return this.employeesValidator;
      case 'EMPLOYMENTS': return this.employmentsValidator;
      case 'EMPLOYMENT_ASSIGNMENTS': return this.employmentAssignmentsValidator;
      case 'MANAGER_RELATIONSHIPS': return this.employeeManagersValidator;
      case 'PAY_GROUPS': return this.payGroupsValidator;
      case 'POSITIONS': return this.positionsValidator;
      default: throw new BadRequestException(`Unsupported dataset type: ${datasetType}`);
    }
  }

  private getPublisher(datasetType: DataImportDatasetType) {
    switch (datasetType) {
      case 'LEGAL_ENTITIES': return this.legalEntitiesPublisher;
      case 'ORG_UNITS': return this.orgUnitsPublisher;
      case 'COST_CENTERS': return this.costCentersPublisher;
      case 'EMPLOYEES': return this.employeesPublisher;
      case 'EMPLOYMENTS': return this.employmentsPublisher;
      case 'EMPLOYMENT_ASSIGNMENTS': return this.employmentAssignmentsPublisher;
      case 'MANAGER_RELATIONSHIPS': return this.employeeManagersPublisher;
      case 'PAY_GROUPS': return this.payGroupsPublisher;
      case 'POSITIONS': return this.positionsPublisher;
      default: throw new BadRequestException(`Unsupported dataset type: ${datasetType}`);
    }
  }

  async deleteJob(jobId: string, userId: string) {
    const job = await this.prisma.dataImportJob.findFirst({
      where: { id: jobId, uploadedByUserId: userId },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    if (job.status === 'PUBLISHED') {
      throw new BadRequestException('Published jobs cannot be deleted');
    }

    await this.prisma.dataImportJob.delete({
      where: { id: jobId },
    });

    await this.auditService.log({
      userId,
      action: 'DATA_IMPORT_JOB_DELETED',
      entityType: 'DataImportJob',
      entityId: jobId,
      newValue: { datasetType: job.datasetType, fileName: job.fileName },
    });

    return { deleted: true };
  }

  async exportValidationErrors(
    jobId: string,
    userId: string,
    format: 'csv' | 'xlsx',
  ): Promise<Buffer> {
    const job = await this.getJob(jobId, userId);
    const grouped = await this.buildGroupedExportErrorRows(jobId);
    const meta = {
      import_job_id: job.id,
      file_name: job.fileName,
      dataset_type: job.datasetType,
      job_status: job.status,
      generated_at_utc: new Date().toISOString(),
      error_rows: grouped.filter((r) => r.severity === 'ERROR').length,
      warning_rows: grouped.filter((r) => r.severity !== 'ERROR').length,
    };
    return format === 'xlsx'
      ? validationWorkbookToXlsx({ groupedRows: grouped, referenceValues: [], meta })
      : groupedErrorsToCsv(grouped);
  }

  async exportValidationReport(
    jobId: string,
    userId: string,
    format: 'csv' | 'xlsx',
  ): Promise<Buffer> {
    const job = await this.getJob(jobId, userId);
    const summary = (job.summaryJson as Record<string, unknown>) ?? {};
    const grouped = await this.buildGroupedExportErrorRows(jobId);

    if (format === 'xlsx') {
      const validationSummary: ValidationSummary = {
        job_id: job.id,
        dataset_type: job.datasetType,
        file_name: job.fileName,
        status: job.status,
        total_rows: (summary.total_rows as number) ?? (summary.totalRows as number) ?? 0,
        valid_rows: (summary.valid_rows as number) ?? (summary.validRows as number) ?? 0,
        invalid_rows: (summary.invalid_rows as number) ?? (summary.failedRows as number) ?? 0,
        errors: (summary.errors as number) ?? (summary.failedRows as number) ?? 0,
        warnings: (summary.warnings as number) ?? (summary.warningRows as number) ?? 0,
        validated_at: job.validatedAt?.toISOString(),
      };
      return validationReportToXlsx(validationSummary, grouped);
    }
    return groupedErrorsToCsv(grouped);
  }

  private async buildGroupedExportErrorRows(jobId: string): Promise<GroupedExportErrorRow[]> {
    const errors = await this.prisma.dataImportError.findMany({
      where: { jobId },
      orderBy: [{ rowNumber: 'asc' }, { createdAt: 'asc' }],
    });

    const importRows = await this.prisma.dataImportRow.findMany({
      where: { jobId },
      select: { rowNumber: true, sheetName: true, sheetRowNumber: true, externalKey: true },
    });
    const rowByGlobalNumber = new Map(importRows.map((r) => [r.rowNumber, r]));
    const rowBySheetAndLine = new Map(
      importRows.map((r) => [`${r.sheetName ?? ''}|${r.sheetRowNumber ?? ''}`, r] as const),
    );

    return errors.map((e) => {
      const legacySheet = legacySheetFromFieldName(e.fieldName);
      const sheetKey = e.sheetName ?? legacySheet ?? '';
      let matched = e.rowNumber != null ? rowByGlobalNumber.get(e.rowNumber) : undefined;
      if (!matched && e.rowNumber != null && sheetKey) {
        matched = rowBySheetAndLine.get(`${sheetKey}|${e.rowNumber}`);
      }
      if (!matched && e.rowNumber != null) {
        matched = importRows.find((r) => r.sheetRowNumber === e.rowNumber && (!sheetKey || r.sheetName === sheetKey));
      }
      return dbValidationErrorToGroupedRow({
        sheetName: e.sheetName ?? legacySheet ?? null,
        fieldName: e.fieldName,
        rowNumber: e.rowNumber,
        errorCode: e.errorCode,
        message: e.message,
        severity: e.severity,
        detailsJson: e.detailsJson,
        matchedSheetName: matched?.sheetName,
        matchedSheetRowNumber: matched?.sheetRowNumber,
      });
    });
  }
}
