import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ImportsService } from './imports.service';
import {
  CreateImportDto,
  ImportType,
  ImportPreviewResponseDto,
  ImportResultDto,
  ExportType,
  CreateExportDto,
} from './dto/import.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('Imports')
@ApiBearerAuth('bearerAuth')
@Controller('imports')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  // ============================================================================
  // Templates
  // ============================================================================

  @Get('templates/:type')
  @Permissions('import:read')
  @ApiOperation({ summary: 'Download CSV template for import type' })
  @ApiParam({ name: 'type', enum: ImportType })
  @Header('Content-Type', 'text/csv')
  async getTemplate(
    @Param('type') type: ImportType,
    @Res() res: Response,
  ): Promise<void> {
    const template = this.importsService.generateTemplate(type);
    res.setHeader('Content-Disposition', `attachment; filename="${type.toLowerCase()}_template.csv"`);
    res.send(template);
  }

  // ============================================================================
  // Import Preview & Execute
  // ============================================================================

  @Post('preview')
  @Permissions('import:write')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Preview import - validate and show what will happen' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: Object.values(ImportType) },
        mode: { type: 'string', enum: ['CREATE_ONLY', 'UPDATE_ONLY', 'UPSERT'] },
        pay_group_id: { type: 'string' },
        payrun_id: { type: 'string' },
        skip_errors: { type: 'boolean' },
      },
      required: ['file', 'type'],
    },
  })
  // @ApiResponse({ status: 200, description: 'Preview', type: () => ImportPreviewResponseDto }) // Temporarily disabled due to Swagger circular dependency
  async previewImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateImportDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ImportPreviewResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.importsService.previewImport(dto, csvContent, user.sub);
  }

  @Post(':importId/execute')
  @Permissions('import:write')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Execute a validated import' })
  @ApiParam({ name: 'importId', description: 'Import ID from preview' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        skip_errors: { type: 'boolean' },
      },
      required: ['file'],
    },
  })
  // @ApiResponse({ status: 200, description: 'Result', type: () => ImportResultDto }) // Temporarily disabled due to Swagger circular dependency
  async executeImport(
    @Param('importId') importId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('skip_errors') skipErrors: boolean,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ImportResultDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.importsService.executeImport(importId, csvContent, skipErrors || false, user.sub);
  }

  // ============================================================================
  // Export
  // ============================================================================

  @Get('export')
  @Permissions('export:read')
  @ApiOperation({ summary: 'Export data to CSV' })
  @ApiQuery({ name: 'type', enum: ExportType })
  @ApiQuery({ name: 'pay_group_id', required: false })
  @ApiQuery({ name: 'legal_entity_id', required: false })
  @ApiQuery({ name: 'payrun_id', required: false })
  @ApiQuery({ name: 'include_inactive', required: false, type: Boolean })
  @Header('Content-Type', 'text/csv')
  async exportData(
    @Query('type') type: ExportType,
    @Query('pay_group_id') payGroupId: string,
    @Query('legal_entity_id') legalEntityId: string,
    @Query('payrun_id') payrunId: string,
    @Query('include_inactive') includeInactive: boolean,
    @Res() res: Response,
  ): Promise<void> {
    const dto: CreateExportDto = {
      type,
      pay_group_id: payGroupId,
      legal_entity_id: legalEntityId,
      payrun_id: payrunId,
      include_inactive: includeInactive,
    };

    const csv = await this.importsService.exportToCSV(dto);
    res.setHeader('Content-Disposition', `attachment; filename="${type.toLowerCase()}_export.csv"`);
    res.send(csv);
  }
}
