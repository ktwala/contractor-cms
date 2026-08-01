import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BankingIntegrationService } from './services/banking-integration.service';
import { AccountingIntegrationService } from './services/accounting-integration.service';
import { SarsEfilingService } from './services/sars-efiling.service';

@ApiTags('Integrations')
@ApiBearerAuth('bearerAuth')
@Controller('api/integrations')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class IntegrationsController {
  constructor(
    private readonly bankingService: BankingIntegrationService,
    private readonly accountingService: AccountingIntegrationService,
    private readonly sarsService: SarsEfilingService,
  ) {}

  // Banking Integrations
  @Post('banking/payments')
  @Permissions('integrations:write')
  @ApiOperation({ summary: 'Submit payments to bank' })
  async submitPayments(@Body() body: any, @Request() req: any) {
    const transactionId = await this.bankingService.submitPayments(
      body.connection_id,
      body.payrun_id,
      req.user.userId,
    );
    return { transaction_id: transactionId };
  }

  @Get('banking/payments/:transaction_id/status')
  @Permissions('integrations:read')
  @ApiOperation({ summary: 'Get payment status' })
  async getPaymentStatus(@Param('transaction_id') transactionId: string) {
    return this.bankingService.getPaymentStatus(transactionId);
  }

  // Accounting Integrations
  @Post('accounting/gl-journal')
  @Permissions('integrations:write')
  @ApiOperation({ summary: 'Sync GL journal to accounting system' })
  async syncGLJournal(@Body() body: any) {
    const queueId = await this.accountingService.syncGLJournal(
      body.connection_id,
      body.gl_journal_id,
    );
    return { queue_id: queueId };
  }

  // SARS eFiling
  @Post('sars/emp201')
  @Permissions('integrations:write')
  @ApiOperation({ summary: 'Submit EMP201 to SARS eFiling' })
  async submitEMP201(@Body() body: any) {
    const submissionId = await this.sarsService.submitEMP201(
      body.connection_id,
      body.emp201_id,
    );
    return { submission_id: submissionId };
  }

  @Get('sars/submissions/:submission_id')
  @Permissions('integrations:read')
  @ApiOperation({ summary: 'Get SARS submission status' })
  async getSARSSubmissionStatus(@Param('submission_id') submissionId: string) {
    return this.sarsService.getSubmissionStatus(submissionId);
  }
}
