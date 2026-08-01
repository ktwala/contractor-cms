import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import axios from 'axios';

/**
 * Banking Integration Service
 * Handles real-time payment submissions to banks via API
 * Supports: Standard Bank, FNB, ABSA, Nedbank (extensible)
 */
@Injectable()
export class BankingIntegrationService {
  private readonly logger = new Logger(BankingIntegrationService.name);

  constructor(private readonly prisma: PrismaService) { }

  async submitPayments(connectionId: string, payrunId: string, userId: string): Promise<string> {
    try {
      const connection = await (this.prisma as any).integrationConnection.findFirst({
        where: { id: connectionId, integrationType: 'banking', status: 'active' },
      });

      if (!connection) throw new Error('Banking connection not found or inactive');

      const payslips = await (this.prisma as any).paySlip.findMany({
        where: { payRunId: payrunId, netPay: { gt: 0 } },
        include: {
          employee: {
            select: { firstName: true, lastName: true, bankAccountNumber: true, bankName: true, branchCode: true, employeeNo: true },
          },
        },
      });

      if (payslips.length === 0) throw new Error('No payslips found for payrun');

      const batchId = `BATCH-${Date.now()}`;
      const totalAmount = payslips.reduce((sum: number, ps: any) => sum + Number(ps.netPay), 0);

      const transaction = await (this.prisma as any).bankingTransaction.create({
        data: {
          connectionId,
          payrunId,
          transactionType: 'salary_payment',
          batchId,
          transactionReference: `PAY-${payrunId.substring(0, 8)}`,
          fromAccount: connection.config?.from_account || '',
          totalAmount,
          totalTransactions: payslips.length,
          status: 'pending',
        },
      });

      for (const payslip of payslips) {
        await (this.prisma as any).bankingTransactionLine.create({
          data: {
            bankingTransactionId: transaction.id,
            payslipId: payslip.id,
            beneficiaryName: `${payslip.employee?.firstName} ${payslip.employee?.lastName}`,
            beneficiaryAccount: payslip.employee?.bankAccountNumber || '',
            beneficiaryBank: payslip.employee?.bankName || '',
            branchCode: payslip.employee?.branchCode || '',
            amount: Number(payslip.netPay),
            reference: `SAL-${payslip.employee?.employeeNo}`,
            paymentType: 'salary',
          },
        });
      }

      await this.submitToBankAPI(connection, transaction.id, payslips);

      this.logger.log(`Payment batch submitted: ${batchId}`);
      return transaction.id;
    } catch (error: any) {
      this.logger.error('Failed to submit payments:', error);
      throw error;
    }
  }

  private async submitToBankAPI(connection: any, transactionId: string, payslips: any[]): Promise<void> {
    try {
      const config = connection.config;

      const paymentRequest = {
        batch_reference: `BATCH-${transactionId.substring(0, 8)}`,
        from_account: config.from_account,
        value_date: new Date().toISOString().split('T')[0],
        payments: payslips.map((ps) => ({
          beneficiary_name: `${ps.employee?.firstName} ${ps.employee?.lastName}`,
          beneficiary_account: ps.employee?.bankAccountNumber,
          branch_code: ps.employee?.branchCode,
          amount: Number(ps.netPay),
          reference: `SAL-${ps.employee?.employeeNo}`,
        })),
      };

      const response = await axios.post(
        `${config.api_base_url}/payments/batch`,
        paymentRequest,
        {
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      await (this.prisma as any).bankingTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'submitted',
          submissionDate: new Date(),
          bankResponse: response.data,
          bankStatusCode: response.data.status_code || 'submitted',
        },
      });

      await this.logSync(connection.id, 'payment', 'outbound', transactionId, 'success', paymentRequest, response.data);
    } catch (error: any) {
      await (this.prisma as any).bankingTransaction.update({
        where: { id: transactionId },
        data: { status: 'failed', bankMessage: error.message },
      });

      await this.logSync(connection.id, 'payment', 'outbound', transactionId, 'failed', null, null, error.message);
      throw error;
    }
  }

  async getPaymentStatus(transactionId: string): Promise<any> {
    const transaction = await (this.prisma as any).bankingTransaction.findUnique({
      where: { id: transactionId },
      include: { connection: true },
    });

    if (!transaction) throw new Error('Transaction not found');

    return {
      transaction_id: transactionId,
      status: transaction.status,
      batch_id: transaction.batchId,
      total_amount: Number(transaction.totalAmount),
      submission_date: transaction.submissionDate,
    };
  }

  private async logSync(
    connectionId: string,
    syncType: string,
    direction: string,
    entityId: string,
    status: string,
    request: any,
    response: any,
    errorMessage?: string,
  ): Promise<void> {
    await (this.prisma as any).integrationSyncLog.create({
      data: {
        connectionId,
        syncType,
        syncDirection: direction,
        entityId,
        status,
        requestPayload: request || undefined,
        responsePayload: response || undefined,
        errorMessage,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }
}
