import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { StatutoryService } from './statutory.service';
import { StatutoryWorkflowService } from './statutory-workflow.service';
import { StatutoryExportService } from './statutory-export.service';
import { GenerateStatutoryReturnDto } from './dto/generate-return.dto';
import { UpdateStatutoryReturnStatusDto } from './dto/update-return-status.dto';
import { MarkStatutoryReturnSubmittedDto } from './dto/mark-submitted.dto';

@Controller('payroll/statutory')
@UseGuards(AuthGuard('jwt'))
export class StatutoryController {
  constructor(
    private readonly statutory: StatutoryService,
    private readonly workflow: StatutoryWorkflowService,
    private readonly exports: StatutoryExportService,
  ) {}

  @Post('payruns/:payrunId/generate')
  async generateFromPayrun(
    @Param('payrunId') payrunId: string,
    @Body() dto: GenerateStatutoryReturnDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id ?? req.user?.sub;
      const returns = await this.statutory.generateFromPayrun(
        payrunId,
        dto.returnCode,
        userId,
      );
      return {
        success: true,
        message: `Generated ${returns.length} statutory return(s)`,
        data: returns,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('payruns/:payrunId/amend/:originalReturnId')
  async generateAmendment(
    @Param('payrunId') payrunId: string,
    @Param('originalReturnId') originalReturnId: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id ?? req.user?.sub;
      const returns = await this.statutory.generateAmendment(
        originalReturnId,
        payrunId,
        userId,
      );
      return {
        success: true,
        message: `Generated ${returns.length} amended return(s)`,
        data: returns,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Get('dashboard')
  async getDashboard() {
    const dashboard = await this.statutory.getComplianceDashboard();
    return { success: true, data: dashboard };
  }

  @Get('returns')
  async listReturns(
    @Query('country_code') countryCode?: string,
    @Query('legal_entity_id') legalEntityId?: string,
    @Query('period_key') periodKey?: string,
    @Query('return_code') returnCode?: string,
    @Query('status') status?: string,
  ) {
    const returns = await this.statutory.listReturns({
      countryCode,
      legalEntityId,
      periodKey,
      returnCode,
      status,
    });
    return { success: true, data: returns };
  }

  @Get('returns/:returnId')
  async getReturn(@Param('returnId') returnId: string) {
    const ret = await this.statutory.getReturn(returnId);
    return { success: true, data: ret };
  }

  @Post('returns/:returnId/submit-for-review')
  async submitForReview(
    @Param('returnId') returnId: string,
    @Body() dto: UpdateStatutoryReturnStatusDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id ?? req.user?.sub;
      const ret = await this.workflow.submitForReview(returnId, userId, dto.comment);
      return { success: true, message: 'Submitted for review', data: { id: ret.id, status: ret.status } };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('returns/:returnId/approve')
  async approve(
    @Param('returnId') returnId: string,
    @Body() dto: UpdateStatutoryReturnStatusDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id ?? req.user?.sub;
      const ret = await this.workflow.approve(returnId, userId, dto.comment);
      return { success: true, message: 'Approved', data: { id: ret.id, status: ret.status } };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('returns/:returnId/mark-submitted')
  async markSubmitted(
    @Param('returnId') returnId: string,
    @Body() dto: MarkStatutoryReturnSubmittedDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id ?? req.user?.sub;
      const ret = await this.workflow.markSubmitted(
        returnId,
        userId,
        dto.submission_reference,
        dto.comment,
      );
      return { success: true, message: 'Marked as submitted', data: { id: ret.id, status: ret.status } };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('returns/:returnId/acknowledge')
  async acknowledge(
    @Param('returnId') returnId: string,
    @Body() dto: UpdateStatutoryReturnStatusDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id ?? req.user?.sub;
      const ret = await this.workflow.acknowledge(returnId, userId, dto.comment);
      return { success: true, message: 'Acknowledged', data: { id: ret.id, status: ret.status } };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('returns/:returnId/cancel')
  async cancel(
    @Param('returnId') returnId: string,
    @Body() dto: UpdateStatutoryReturnStatusDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id ?? req.user?.sub;
      const ret = await this.workflow.cancel(returnId, userId, dto.comment);
      return { success: true, message: 'Cancelled', data: { id: ret.id, status: ret.status } };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Get('returns/:returnId/evidence')
  async getEvidence(@Param('returnId') returnId: string) {
    const bundle = await this.statutory.getReturnEvidence(returnId);
    return { success: true, data: bundle };
  }

  @Get('returns/:returnId/export')
  async exportReturn(
    @Param('returnId') returnId: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    if (!['json', 'csv', 'xlsx', 'pdf'].includes(format)) {
      throw new BadRequestException(`Unsupported format: ${format}. Supported: json, csv, xlsx, pdf`);
    }

    const result = await this.exports.exportReturn(
      returnId,
      format as 'json' | 'csv' | 'xlsx' | 'pdf',
    );

    res.setHeader('Content-Type', result.mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.content);
  }
}
