import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Res,
  StreamableFile,
  Header,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SarsTaxService } from './services/sars-tax.service';
import { IRP5PdfService } from './services/irp5-pdf.service';
import { EMP201CsvService } from './services/emp201-csv.service';
import { EMP501ReconciliationService, EMP501Reconciliation } from './services/emp501-reconciliation.service';
import { SarsValidationService, ValidationReport } from './services/sars-validation.service';
import { BulkSubmissionService, SubmissionBatch } from './services/bulk-submission.service';
import { EmailNotificationService } from '../notifications/email-notification.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('SARS Tax Forms')
@ApiBearerAuth('bearerAuth')
@Controller('api/sars')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SarsController {
  constructor(
    private readonly sarsTaxService: SarsTaxService,
    private readonly irp5PdfService: IRP5PdfService,
    private readonly emp201CsvService: EMP201CsvService,
    private readonly emp501Service: EMP501ReconciliationService,
    private readonly validationService: SarsValidationService,
    private readonly bulkSubmissionService: BulkSubmissionService,
    private readonly emailService: EmailNotificationService,
  ) {}

  // ==================== TAX PERIODS ====================

  @Get('tax-periods')
  @Permissions('sars:tax_periods:read')
  @ApiOperation({ summary: 'Get tax periods' })
  @ApiQuery({ name: 'tax_year', required: false })
  @ApiQuery({ name: 'period_type', required: false, enum: ['annual', 'monthly'] })
  async getTaxPeriods(
    @CurrentUser() user: CurrentUserData,
    @Query('tax_year') taxYear?: string,
    @Query('period_type') periodType?: string,
  ) {
    return this.sarsTaxService.getTaxPeriods(
      { tax_year: taxYear, period_type: periodType },
      user,
    );
  }

  // ==================== IRP5 CERTIFICATES ====================

  @Post('irp5/generate/:tax_period_id')
  @Permissions('sars:irp5:generate')
  @ApiOperation({ summary: 'Generate IRP5 certificates for all employees' })
  @ApiResponse({ status: 201, description: 'IRP5 certificates generated' })
  async generateIRP5Certificates(
    @Param('tax_period_id') taxPeriodId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.sarsTaxService.generateIRP5Certificates(taxPeriodId, user);
  }

  @Post('irp5/generate/:tax_period_id/:employee_id')
  @Permissions('sars:irp5:generate')
  @ApiOperation({ summary: 'Generate IRP5 certificate for specific employee' })
  @ApiResponse({ status: 201, description: 'IRP5 certificate generated' })
  async generateIRP5ForEmployee(
    @Param('tax_period_id') taxPeriodId: string,
    @Param('employee_id') employeeId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.sarsTaxService.generateIRP5ForEmployee(taxPeriodId, employeeId, user);
  }

  @Get('irp5/:tax_period_id')
  @Permissions('sars:irp5:read')
  @ApiOperation({ summary: 'Get IRP5 certificates for tax period' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'employee_id', required: false })
  @ApiResponse({ status: 200, description: 'List of IRP5 certificates' })
  async getIRP5Certificates(
    @Param('tax_period_id') taxPeriodId: string,
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: string,
    @Query('employee_id') employeeId?: string,
  ) {
    return this.sarsTaxService.getIRP5Certificates(
      taxPeriodId,
      { status, employee_id: employeeId },
      user,
    );
  }

  // ==================== EMP201 RETURNS ====================

  @Post('emp201/generate/:tax_period_id')
  @Permissions('sars:emp201:generate')
  @ApiOperation({ summary: 'Generate EMP201 monthly return' })
  @ApiResponse({ status: 201, description: 'EMP201 return generated' })
  async generateEMP201(
    @Param('tax_period_id') taxPeriodId: string,
    @Body() body: { legal_entity_id: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.sarsTaxService.generateEMP201Return(taxPeriodId, body, user);
  }

  @Get('emp201')
  @Permissions('sars:emp201:read')
  @ApiOperation({ summary: 'Get EMP201 returns' })
  @ApiQuery({ name: 'tax_year', required: false })
  @ApiQuery({ name: 'month_number', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'List of EMP201 returns' })
  async getEMP201Returns(
    @CurrentUser() user: CurrentUserData,
    @Query('tax_year') taxYear?: string,
    @Query('month_number') monthNumber?: number,
    @Query('status') status?: string,
  ) {
    return this.sarsTaxService.getEMP201Returns(
      {
        tax_year: taxYear,
        month_number: monthNumber ? parseInt(monthNumber.toString()) : undefined,
        status,
      },
      user,
    );
  }

  @Post('emp201/:id/submit')
  @Permissions('sars:emp201:submit')
  @ApiOperation({ summary: 'Mark EMP201 as submitted to SARS' })
  @ApiResponse({ status: 200, description: 'EMP201 marked as submitted' })
  async submitEMP201(
    @Param('id') id: string,
    @Body() body: { submitted_by: string; sars_reference?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.sarsTaxService.submitEMP201(id, body.submitted_by, body.sars_reference, user);
    return { success: true };
  }

  // ==================== EXPORTS ====================

  @Get('irp5/:id/pdf')
  @Permissions('sars:irp5:export')
  @ApiOperation({ summary: 'Download IRP5 certificate as PDF' })
  @ApiResponse({ status: 200, description: 'PDF file' })
  @Header('Content-Type', 'application/pdf')
  async downloadIRP5PDF(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: CurrentUserData) {
    try {
      // Get IRP5 certificate data (scoped)
      const [certificate] = await this.sarsTaxService.getIRP5ById(id, user);

      if (!certificate) {
        return res.status(404).json({ error: 'IRP5 certificate not found' });
      }

      // Generate PDF
      const pdfBuffer = await this.irp5PdfService.generateIRP5PDF(certificate);

      // Set headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="IRP5_${certificate.employee_number}_${certificate.tax_year}.pdf"`,
      );

      // Send PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Failed to generate IRP5 PDF:', error);
      return res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }

  @Get('irp5/bulk/:tax_period_id/pdf')
  @Permissions('sars:irp5:export')
  @ApiOperation({ summary: 'Download all IRP5 certificates for tax period as single PDF' })
  @ApiResponse({ status: 200, description: 'PDF file' })
  @Header('Content-Type', 'application/pdf')
  async downloadBulkIRP5PDF(
    @Param('tax_period_id') taxPeriodId: string,
    @Res() res: Response,
    @CurrentUser() user: CurrentUserData,
  ) {
    try {
      // Get all IRP5 certificates for the period (scoped)
      const certificates = await this.sarsTaxService.getIRP5Certificates(taxPeriodId, {}, user);

      if (certificates.length === 0) {
        return res.status(404).json({ error: 'No IRP5 certificates found for this period' });
      }

      // Generate bulk PDF
      const pdfBuffer = await this.irp5PdfService.generateBulkIRP5PDF(certificates);

      // Set headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="IRP5_Bulk_${certificates[0].tax_year}.pdf"`,
      );

      // Send PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Failed to generate bulk IRP5 PDF:', error);
      return res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }

  @Get('emp201/:id/csv')
  @Permissions('sars:emp201:export')
  @ApiOperation({ summary: 'Download EMP201 return as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  @Header('Content-Type', 'text/csv')
  async downloadEMP201CSV(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: CurrentUserData) {
    try {
      // Get EMP201 return data (scoped)
      const emp201 = await this.sarsTaxService.getEMP201ById(id, user);

      if (!emp201) {
        return res.status(404).json({ error: 'EMP201 return not found' });
      }

      // Generate CSV
      const csvBuffer = this.emp201CsvService.generateEMP201Buffer(emp201);

      // Set headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="EMP201_${emp201.period_month}.csv"`,
      );

      // Send CSV
      res.send(csvBuffer);
    } catch (error) {
      console.error('Failed to generate EMP201 CSV:', error);
      return res.status(500).json({ error: 'Failed to generate CSV' });
    }
  }

  @Get('emp201/:id/efiling-csv')
  @Permissions('sars:emp201:export')
  @ApiOperation({ summary: 'Download EMP201 return as SARS eFiling CSV' })
  @ApiResponse({ status: 200, description: 'SARS eFiling CSV file' })
  @Header('Content-Type', 'text/csv')
  async downloadEMP201eFilingCSV(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: CurrentUserData) {
    try {
      // Get EMP201 return data (scoped)
      const emp201 = await this.sarsTaxService.getEMP201ById(id, user);

      if (!emp201) {
        return res.status(404).json({ error: 'EMP201 return not found' });
      }

      // Validate before export
      const validation = this.emp201CsvService.validateEMP201(emp201);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid EMP201 data',
          errors: validation.errors,
        });
      }

      // Generate SARS eFiling CSV
      const csvBuffer = this.emp201CsvService.generateSARSeFilingBuffer(emp201);

      // Set headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="EMP201_eFiling_${emp201.period_month}.csv"`,
      );

      // Send CSV
      res.send(csvBuffer);
    } catch (error) {
      console.error('Failed to generate EMP201 eFiling CSV:', error);
      return res.status(500).json({ error: 'Failed to generate CSV' });
    }
  }

  // ==================== EMP501 RECONCILIATION (Phase 2) ====================

  @Post('emp501/reconcile/:tax_period_id')
  @Permissions('sars:emp501:generate')
  @ApiOperation({ summary: 'Generate EMP501 year-end reconciliation' })
  @ApiResponse({ status: 201, description: 'Reconciliation generated' })
  async generateEMP501Reconciliation(
    @Param('tax_period_id') taxPeriodId: string,
    @Body() body: { legal_entity_id?: string },
    @CurrentUser() user: CurrentUserData,
  ): Promise<EMP501Reconciliation> {
    return this.emp501Service.generateReconciliation(taxPeriodId, body, user);
  }

  @Get('emp501/:id')
  @Permissions('sars:emp501:read')
  @ApiOperation({ summary: 'Get EMP501 reconciliation by ID' })
  async getEMP501(@Param('id') id: string, @CurrentUser() user: CurrentUserData): Promise<EMP501Reconciliation> {
    const result = await this.emp501Service.getReconciliation(id, user);
    if (!result) {
      throw new NotFoundException(`EMP501 reconciliation with id ${id} not found`);
    }
    return result;
  }

  @Post('emp501/:id/approve')
  @Permissions('sars:emp501:approve')
  @ApiOperation({ summary: 'Approve EMP501 reconciliation' })
  async approveEMP501(
    @Param('id') id: string,
    @Body() body: { approved_by: string; notes?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.emp501Service.approveReconciliation(id, body.approved_by, body.notes, user);
    return { success: true };
  }

  @Get('emp501/:id/csv')
  @Permissions('sars:emp501:export')
  @ApiOperation({ summary: 'Download EMP501 reconciliation as CSV' })
  @Header('Content-Type', 'text/csv')
  async downloadEMP501CSV(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: CurrentUserData) {
    try {
      const csv = await this.emp501Service.generateEMP501CSV(id, user);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="EMP501_${id}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Failed to generate EMP501 CSV:', error);
      return res.status(500).json({ error: 'Failed to generate CSV' });
    }
  }

  // ==================== VALIDATION (Phase 2) ====================

  @Post('validate/irp5/:id')
  @Permissions('sars:validation:run')
  @ApiOperation({ summary: 'Validate IRP5 certificate' })
  async validateIRP5(@Param('id') id: string, @CurrentUser() user: CurrentUserData): Promise<ValidationReport> {
    return this.validationService.validateIRP5(id, user);
  }

  @Post('validate/emp201/:id')
  @Permissions('sars:validation:run')
  @ApiOperation({ summary: 'Validate EMP201 return' })
  async validateEMP201(@Param('id') id: string, @CurrentUser() user: CurrentUserData): Promise<ValidationReport> {
    return this.validationService.validateEMP201(id, user);
  }

  @Post('validate/emp501/:id')
  @Permissions('sars:validation:run')
  @ApiOperation({ summary: 'Validate EMP501 reconciliation' })
  async validateEMP501(@Param('id') id: string, @CurrentUser() user: CurrentUserData): Promise<ValidationReport> {
    return this.validationService.validateEMP501(id, user);
  }

  @Post('validate/irp5/bulk/:tax_period_id')
  @Permissions('sars:validation:run')
  @ApiOperation({ summary: 'Bulk validate all IRP5 certificates for tax period' })
  async bulkValidateIRP5(
    @Param('tax_period_id') taxPeriodId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ total: number; passed: number; failed: number; reports: ValidationReport[] }> {
    return this.validationService.validateAllIRP5(taxPeriodId, user);
  }

  // ==================== BULK SUBMISSION (Phase 2) ====================

  @Post('submit/bulk/irp5/:tax_period_id')
  @Permissions('sars:submission:manage')
  @ApiOperation({ summary: 'Queue IRP5 certificates for bulk submission' })
  async queueIRP5BulkSubmission(
    @Param('tax_period_id') taxPeriodId: string,
    @Body() body: { queued_by: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.bulkSubmissionService.queueIRP5Batch(taxPeriodId, body.queued_by, user);
  }

  @Post('submit/bulk/emp201/:tax_year')
  @Permissions('sars:submission:manage')
  @ApiOperation({ summary: 'Queue EMP201 returns for bulk submission' })
  async queueEMP201BulkSubmission(
    @Param('tax_year') taxYear: string,
    @Body() body: { queued_by: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.bulkSubmissionService.queueEMP201Batch(taxYear, body.queued_by, user);
  }

  @Post('submit/process/:batch_id')
  @Permissions('sars:submission:manage')
  @ApiOperation({ summary: 'Process submission queue for batch' })
  async processSubmissionBatch(@Param('batch_id') batchId: string, @CurrentUser() user: CurrentUserData) {
    return this.bulkSubmissionService.processQueue(batchId, user);
  }

  @Get('submit/batch/:batch_id/status')
  @Permissions('sars:submission:read')
  @ApiOperation({ summary: 'Get bulk submission batch status' })
  async getBatchSubmissionStatus(
    @Param('batch_id') batchId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<SubmissionBatch> {
    return this.bulkSubmissionService.getBatchStatus(batchId, user);
  }

  @Post('submit/batch/:batch_id/retry')
  @Permissions('sars:submission:manage')
  @ApiOperation({ summary: 'Retry failed submissions in batch' })
  async retryFailedSubmissions(@Param('batch_id') batchId: string, @CurrentUser() user: CurrentUserData) {
    return this.bulkSubmissionService.retryFailedInBatch(batchId, user);
  }

  // ==================== EMAIL DISTRIBUTION (Phase 2) ====================

  @Post('irp5/:id/email')
  @Permissions('sars:irp5:email')
  @ApiOperation({ summary: 'Email IRP5 certificate to employee' })
  async emailIRP5Certificate(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    try {
      // Get IRP5 and employee data (scoped)
      const [certificate] = await this.sarsTaxService.getIRP5ById(id, user);
      if (!certificate) {
        return { error: 'IRP5 certificate not found' };
      }

      // Generate PDF
      const pdfBuffer = await this.irp5PdfService.generateIRP5PDF(certificate);

      // Send email
      const notificationId = await this.emailService.sendIRP5Certificate(
        certificate.employee_id,
        certificate.id,
        pdfBuffer,
        certificate.tax_year
      );

      return { success: true, notification_id: notificationId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('irp5/bulk/:tax_period_id/email')
  @Permissions('sars:irp5:email')
  @ApiOperation({ summary: 'Email all IRP5 certificates for tax period' })
  async bulkEmailIRP5Certificates(
    @Param('tax_period_id') taxPeriodId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    try {
      const allowed = user.legalEntityAccess || [];
      if (allowed.length === 0) {
        return { total: 0, sent: 0, failed: 0, results: [], error: 'No legal entity access' };
      }
      const result = await this.emailService.bulkSendIRP5Certificates(
        taxPeriodId,
        async (irp5Id: string) => {
          const [cert] = await this.sarsTaxService.getIRP5ById(irp5Id, user);
          return this.irp5PdfService.generateIRP5PDF(cert);
        },
        allowed
      );

      return result;
    } catch (error: any) {
      return { error: error.message };
    }
  }
}
