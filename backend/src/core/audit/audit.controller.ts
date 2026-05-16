import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions.constants';
import * as csvWriter from 'csv-writer';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // ---------------------------------------------------------------------------
  // List — paginated with filters
  // ---------------------------------------------------------------------------

  @Get()
  @Permissions(PERMISSIONS.AUDIT.READ)
  @ApiOperation({ summary: 'List audit logs with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated audit log list' })
  async listLogs(@Query() params: ListAuditLogsDto) {
    return this.auditService.findAllPaginated(params);
  }

  // ---------------------------------------------------------------------------
  // Export — CSV with limits
  // ---------------------------------------------------------------------------

  @Get('export')
  @Permissions(PERMISSIONS.AUDIT.READ)
  @ApiOperation({ summary: 'Export audit logs as CSV (max 31 days, 10k rows)' })
  @ApiResponse({ status: 200, description: 'CSV file containing audit logs' })
  async exportLogs(@Query() params: ListAuditLogsDto, @Res() res: Response) {
    let logs;
    try {
      logs = await this.auditService.findForExport(params);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    const csvStringifier = csvWriter.createObjectCsvStringifier({
      header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'actorEmail', title: 'Actor Email' },
        { id: 'action', title: 'Action' },
        { id: 'targetType', title: 'Target Type' },
        { id: 'targetId', title: 'Target ID' },
        { id: 'result', title: 'Result' },
        { id: 'ipAddress', title: 'IP Address' },
      ],
    });

    // Flat CSV format — no raw JSON blobs
    const records = logs.map((log: any) => ({
      timestamp: new Date(log.createdAt).toISOString(),
      actorEmail: log.actor?.email ?? log.actorUserId ?? 'SYSTEM',
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      result: log.result,
      ipAddress: log.ipAddress ?? '',
    }));

    const csv =
      csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

    res.header('Content-Type', 'text/csv');
    res.attachment('audit-logs.csv');
    return res.send(csv);
  }

  // ---------------------------------------------------------------------------
  // Detail — single log
  // ---------------------------------------------------------------------------

  @Get(':id')
  @Permissions(PERMISSIONS.AUDIT.READ)
  @ApiOperation({ summary: 'Get a single audit log entry' })
  @ApiResponse({ status: 200, description: 'Audit log detail' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async getLog(@Param('id') id: string) {
    const log = await this.auditService.findOne(id);
    if (!log) {
      throw new NotFoundException(`Audit log ${id} not found`);
    }
    return log;
  }
}
