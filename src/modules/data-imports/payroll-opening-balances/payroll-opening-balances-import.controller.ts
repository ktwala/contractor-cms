import {
  BadRequestException,
  Body,
  Controller,
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
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { AnyPermissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PayrollOpeningBalancesImportService } from './payroll-opening-balances-import.service';

@Controller('data-imports/payroll-opening-balances')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayrollOpeningBalancesImportController {
  constructor(private readonly service: PayrollOpeningBalancesImportService) {}

  @Post('upload')
  @AnyPermissions('data_import:write', 'data_import:approve')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('countryCode') countryCode: string,
    @Body('taxYear') taxYear: string,
    @Body('asOfDate') asOfDate: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!file?.buffer) throw new BadRequestException('File is required');
    if (!countryCode) throw new BadRequestException('countryCode is required');
    if (!taxYear) throw new BadRequestException('taxYear is required');

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') throw new BadRequestException('Only .xlsx files are supported');

    return this.service.uploadAndValidate(file.buffer, file.originalname, userId, {
      countryCode: countryCode.toUpperCase(),
      taxYear: parseInt(taxYear, 10),
      asOfDate: asOfDate || undefined,
    });
  }

  @Post('precheck')
  @AnyPermissions('data_import:write', 'data_import:approve')
  @UseInterceptors(FileInterceptor('file'))
  async precheck(
    @UploadedFile() file: Express.Multer.File,
    @Body('countryCode') countryCode: string,
    @Body('taxYear') taxYear: string,
    @Body('asOfDate') asOfDate: string,
  ) {
    if (!file?.buffer) throw new BadRequestException('File is required');
    if (!countryCode) throw new BadRequestException('countryCode is required');
    if (!taxYear) throw new BadRequestException('taxYear is required');

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') throw new BadRequestException('Only .xlsx files are supported');

    return this.service.precheck(file.buffer, {
      countryCode: countryCode.toUpperCase(),
      taxYear: parseInt(taxYear, 10),
      asOfDate: asOfDate || undefined,
    });
  }

  @Post('precheck/export-errors')
  @AnyPermissions('data_import:write', 'data_import:approve')
  @UseInterceptors(FileInterceptor('file'))
  async precheckExportErrors(
    @UploadedFile() file: Express.Multer.File,
    @Body('countryCode') countryCode: string,
    @Body('taxYear') taxYear: string,
    @Body('asOfDate') asOfDate: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    if (!file?.buffer) throw new BadRequestException('File is required');
    if (!countryCode) throw new BadRequestException('countryCode is required');
    if (!taxYear) throw new BadRequestException('taxYear is required');

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') throw new BadRequestException('Only .xlsx files are supported');

    const fmt = (format ?? 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
    const buffer = await this.service.exportPrecheckErrors(file.buffer, fmt, file.originalname, {
      countryCode: countryCode.toUpperCase(),
      taxYear: parseInt(taxYear, 10),
      asOfDate: asOfDate || undefined,
    });
    const filename = `opening-balances-precheck-validation.${fmt}`;
    res.setHeader('Content-Type', fmt === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':importJobId/preview')
  @AnyPermissions('data_import:read', 'data_import:write')
  async getPreview(@Param('importJobId') importJobId: string) {
    return this.service.getPreview(importJobId);
  }

  @Post(':importJobId/execute')
  @AnyPermissions('data_import:approve', 'data_import:publish')
  async execute(
    @Param('importJobId') importJobId: string,
    @Body() body: { confirm?: boolean },
    @CurrentUser('sub') userId: string,
  ) {
    if (!body?.confirm) throw new BadRequestException('Confirmation required: { "confirm": true }');
    return this.service.execute(importJobId, userId);
  }

  @Get(':importJobId/export-errors')
  @AnyPermissions('data_import:read', 'data_import:write')
  async exportErrors(
    @Param('importJobId') importJobId: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const fmt = (format ?? 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
    const buffer = await this.service.exportErrors(importJobId, fmt);
    const filename = `validation-errors-${importJobId}.${fmt}`;
    res.setHeader('Content-Type', fmt === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':importJobId')
  @AnyPermissions('data_import:read', 'data_import:write')
  async getJob(@Param('importJobId') importJobId: string) {
    return this.service.getJob(importJobId);
  }
}
