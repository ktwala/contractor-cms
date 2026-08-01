import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import {
  GLExportQueryDto,
  GLJournalExportDto,
  BankFileQueryDto,
  BankFileExportDto,
  StatutoryReportQueryDto,
  ExportFormat,
} from './dto/exports.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  // ============================================================================
  // GL Exports
  // ============================================================================

  @Get('gl/journal')
  @Permissions('export:gl')
  async getGLJournal(@Query() query: GLExportQueryDto): Promise<GLJournalExportDto> {
    return this.exportsService.generateGLExport(query);
  }

  @Get('gl/journal/download')
  @Permissions('export:gl')
  async downloadGLJournal(
    @Query() query: GLExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.exportsService.generateGLExport(query);
    const format = query.format || ExportFormat.CSV;
    const result = await this.exportsService.exportToFormat(
      data,
      format,
      `gl-journal-${data.journal_reference}`,
    );

    this.sendFile(res, result.content!, result.file_name, format);
  }

  // ============================================================================
  // Bank File Exports
  // ============================================================================

  @Get('bank-file')
  @Permissions('export:bank')
  async getBankFile(@Query() query: BankFileQueryDto, @CurrentUser('sub') userId: string): Promise<BankFileExportDto> {
    return this.exportsService.generateBankFile(userId || 'system', query);
  }

  @Get('bank-file/download')
  @Permissions('export:bank')
  async downloadBankFile(
    @Query() query: BankFileQueryDto,
    @Res() res: Response,
    @CurrentUser('sub') userId: any,
  ): Promise<void> {
    const data = await this.exportsService.generateBankFile(userId || 'system', query);

    const contentType = data.file_format === 'CSV' ? 'text/csv' : 'text/plain';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${data.file_name}"`);
    res.send(data.file_content);
  }

  // ============================================================================
  // Statutory Reports
  // ============================================================================

  @Get('statutory')
  @Permissions('export:statutory')
  async getStatutoryReport(@Query() query: StatutoryReportQueryDto): Promise<any> {
    return this.exportsService.generateStatutoryReport(query);
  }

  @Get('statutory/download')
  @Permissions('export:statutory')
  async downloadStatutoryReport(
    @Query() query: StatutoryReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.exportsService.generateStatutoryReport(query);
    const format = query.format || ExportFormat.CSV;
    const result = await this.exportsService.exportToFormat(
      data,
      format,
      `${query.report_type.toLowerCase()}-${data.tax_period || data.tax_year || 'report'}`.replace(/\s+/g, '-'),
    );

    this.sendFile(res, result.content!, result.file_name, format);
  }

  // ============================================================================
  // EMP201 Specific
  // ============================================================================

  @Get('emp201')
  @Permissions('export:statutory')
  async getEMP201(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('tax_month') taxMonth?: string,
  ): Promise<any> {
    return this.exportsService.generateEMP201({
      report_type: 'EMP201' as any,
      legal_entity_id: legalEntityId,
      tax_month: taxMonth,
    });
  }

  @Get('emp201/download')
  @Permissions('export:statutory')
  async downloadEMP201(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('tax_month') taxMonth: string,
    @Query('format') format: ExportFormat = ExportFormat.CSV,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.exportsService.generateEMP201({
      report_type: 'EMP201' as any,
      legal_entity_id: legalEntityId,
      tax_month: taxMonth,
    });

    const result = await this.exportsService.exportToFormat(
      data,
      format,
      `emp201-${taxMonth}`,
    );

    this.sendFile(res, result.content!, result.file_name, format);
  }

  // ============================================================================
  // IRP5 Batch
  // ============================================================================

  @Get('irp5/batch')
  @Permissions('export:statutory')
  async getIRP5Batch(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('tax_year') taxYear?: string,
  ): Promise<any> {
    return this.exportsService.generateIRP5Batch({
      report_type: 'IRP5_BATCH' as any,
      legal_entity_id: legalEntityId,
      tax_year: taxYear,
    });
  }

  @Get('irp5/batch/download')
  @Permissions('export:statutory')
  async downloadIRP5Batch(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('tax_year') taxYear: string,
    @Query('format') format: ExportFormat = ExportFormat.CSV,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.exportsService.generateIRP5Batch({
      report_type: 'IRP5_BATCH' as any,
      legal_entity_id: legalEntityId,
      tax_year: taxYear,
    });

    const result = await this.exportsService.exportToFormat(
      data,
      format,
      `irp5-batch-${taxYear.replace('/', '-')}`,
    );

    this.sendFile(res, result.content!, result.file_name, format);
  }

  // ============================================================================
  // UIF Declaration
  // ============================================================================

  @Get('ui19')
  @Permissions('export:statutory')
  async getUI19(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ): Promise<any> {
    return this.exportsService.generateUI19({
      report_type: 'UI19' as any,
      legal_entity_id: legalEntityId,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private sendFile(res: Response, content: string, fileName: string, format: ExportFormat): void {
    let contentType: string;

    switch (format) {
      case ExportFormat.CSV:
        contentType = 'text/csv';
        break;
      case ExportFormat.XML:
        contentType = 'application/xml';
        break;
      case ExportFormat.TXT:
        contentType = 'text/plain';
        break;
      default:
        contentType = 'application/json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(content);
  }
}
