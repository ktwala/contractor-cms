import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EffectiveDatedService } from '../../employees/effective-dated.service';
import { format } from 'date-fns';
import { BankFileRecord } from '../dto/report.dto';

/**
 * South African ACB (Automated Clearing Bureau) file format
 * Used for bulk EFT payments via Bankserv
 */
interface ACBHeader {
  recordId: '001';
  userCode: string; // 4 chars
  creationDate: string; // CCYYMMDD
  purgeDate: string; // CCYYMMDD
  firstActionDate: string; // CCYYMMDD
  lastActionDate: string; // CCYYMMDD
  firstSeqNo: string; // 6 digits
  userGenerationNo: string; // 4 digits
  typeOfService: 'SALARY' | 'CREDITORS';
}

interface ACBTransaction {
  recordId: '002';
  branchCode: string; // 6 digits
  accountNumber: string; // 11 chars
  accountType: '1' | '2' | '3'; // 1=Current, 2=Savings, 3=Transmission
  amount: number; // cents
  actionDate: string; // CCYYMMDD (or 000000 for first action date)
  entryClass: '32' | '44'; // 32=Credit, 44=Debit
  taxCode: '0'; // 0=No tax
  userReference: string; // 10 chars
  homingBranch: string; // 6 digits
  homingAccount: string; // 11 chars
  homingAccountType: '1' | '2' | '3';
  sequenceNo: string; // 6 digits
  userName: string; // 30 chars
  homingInstitution: string; // 2 digits
  nominatedAccount: string; // 11 chars
}

interface ACBContra {
  recordId: '003' | '004';
  branchCode: string;
  accountNumber: string;
  accountType: '1' | '2' | '3';
  amount: number;
  actionDate: string;
  entryClass: '32' | '44';
  homingBranch: string;
  sequenceNo: string;
  userName: string;
}

interface ACBTrailer {
  recordId: '005';
  noOfRecords: string; // 6 digits
  hashTotalOfHomingAccountNo: string; // 12 digits
  hashTotalOfHomingBranch: string; // 12 digits
}

@Injectable()
export class BankFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectiveDatedService: EffectiveDatedService,
  ) {}

  /**
   * Generate bank file records for a payrun
   * CRITICAL: Decrypts account numbers for bank file generation (audit logged)
   */
  async generateBankFileRecords(
    payrunId: string,
    userId: string,
  ): Promise<BankFileRecord[]> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: {
          include: { legalEntity: true },
        },
        period: true,
      },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${payrunId} not found`);
    }

    if (!['APPROVED', 'PAID'].includes(payrun.status)) {
      throw new BadRequestException(
        `Cannot generate bank file for payrun in ${payrun.status} status`,
      );
    }

    // Get employee results with bank accounts
    const results = await this.prisma.employeeResult.findMany({
      where: { payrunId },
      include: {
        employee: {
          include: {
            bankAccounts: {
              where: { effectiveTo: null },
              take: 1,
              orderBy: { effectiveFrom: 'desc' },
            },
          },
        },
      },
    });

    const records: BankFileRecord[] = [];

    for (const result of results) {
      const employee = result.employee;
      const bankAccount = employee.bankAccounts[0];

      if (!bankAccount) {
        console.warn(`No bank account for employee ${employee.employeeNo}`);
        continue;
      }

      if (Number(result.net) <= 0) {
        continue; // Skip zero/negative payments
      }

      // CRITICAL: Decrypt account number for bank file (audit logged)
      const decryptedAccountNumber = await this.effectiveDatedService.getDecryptedAccountNumber(
        bankAccount.id,
        userId,
        `Generating bank file for payrun ${payrunId}`,
      );

      records.push({
        employee_id: employee.id,
        employee_no: employee.employeeNo,
        employee_name: `${employee.firstName} ${employee.lastName}`,
        bank_name: bankAccount.bankName,
        branch_code: bankAccount.branchCode || '',
        account_number: decryptedAccountNumber,
        account_type: bankAccount.accountType || 'CHEQUE',
        amount: Number(result.net),
        reference: `SAL${format(payrun.period?.endDate || payrun.periodEnd || new Date(), 'yyyyMM')}`,
      });
    }

    return records;
  }

  /**
   * Generate ACB file content (South African Bankserv format)
   */
  async generateACBFile(
    payrunId: string,
    userId: string,
    options: {
      userCode: string;
      userGenerationNo: number;
      contraAccountBranch: string;
      contraAccountNumber: string;
      contraAccountType: '1' | '2' | '3';
    },
  ): Promise<string> {
    const records = await this.generateBankFileRecords(payrunId, userId);

    if (records.length === 0) {
      throw new BadRequestException('No valid payment records to include in bank file');
    }

    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: { include: { legalEntity: true } },
        period: true,
      },
    });

    const actionDate = payrun!.period?.payDate || payrun!.period?.endDate || payrun!.periodEnd || new Date();
    const creationDate = new Date();

    const lines: string[] = [];

    // Header record (001)
    lines.push(this.formatACBHeader({
      recordId: '001',
      userCode: options.userCode.padStart(4, ' '),
      creationDate: format(creationDate, 'yyyyMMdd'),
      purgeDate: format(actionDate, 'yyyyMMdd'),
      firstActionDate: format(actionDate, 'yyyyMMdd'),
      lastActionDate: format(actionDate, 'yyyyMMdd'),
      firstSeqNo: '000001',
      userGenerationNo: options.userGenerationNo.toString().padStart(4, '0'),
      typeOfService: 'SALARY',
    }));

    // Transaction records (002)
    let seqNo = 1;
    let totalAmount = 0;
    let hashBranch = 0;
    let hashAccount = 0;

    for (const record of records) {
      const amountCents = Math.round(record.amount * 100);
      totalAmount += amountCents;

      const branchCode = record.branch_code.padStart(6, '0');
      const accountNumber = record.account_number.padStart(11, '0');

      hashBranch += parseInt(branchCode, 10) || 0;
      hashAccount += parseInt(accountNumber.replace(/\D/g, ''), 10) || 0;

      lines.push(this.formatACBTransaction({
        recordId: '002',
        branchCode,
        accountNumber,
        accountType: this.mapAccountType(record.account_type),
        amount: amountCents,
        actionDate: '000000', // Use first action date from header
        entryClass: '32', // Credit
        taxCode: '0',
        userReference: record.reference.padEnd(10, ' ').substring(0, 10),
        homingBranch: branchCode,
        homingAccount: accountNumber,
        homingAccountType: this.mapAccountType(record.account_type),
        sequenceNo: (seqNo++).toString().padStart(6, '0'),
        userName: record.employee_name.padEnd(30, ' ').substring(0, 30),
        homingInstitution: '00',
        nominatedAccount: accountNumber,
      }));
    }

    // Contra record (004) - Debit from company account
    lines.push(this.formatACBContra({
      recordId: '004',
      branchCode: options.contraAccountBranch.padStart(6, '0'),
      accountNumber: options.contraAccountNumber.padStart(11, '0'),
      accountType: options.contraAccountType,
      amount: totalAmount,
      actionDate: '000000',
      entryClass: '44', // Debit
      homingBranch: options.contraAccountBranch.padStart(6, '0'),
      sequenceNo: (seqNo++).toString().padStart(6, '0'),
      userName: payrun!.payGroup.legalEntity.name.padEnd(30, ' ').substring(0, 30),
    }));

    // Trailer record (005)
    lines.push(this.formatACBTrailer({
      recordId: '005',
      noOfRecords: seqNo.toString().padStart(6, '0'),
      hashTotalOfHomingAccountNo: (hashAccount % 1000000000000).toString().padStart(12, '0'),
      hashTotalOfHomingBranch: (hashBranch % 1000000000000).toString().padStart(12, '0'),
    }));

    return lines.join('\r\n');
  }

  /**
   * Generate simple CSV bank file (for non-ACB systems)
   */
  async generateCSVBankFile(payrunId: string, userId: string): Promise<string> {
    const records = await this.generateBankFileRecords(payrunId, userId);

    const lines: string[] = [];
    lines.push('Employee No,Employee Name,Bank,Branch Code,Account Number,Account Type,Amount,Reference');

    for (const record of records) {
      lines.push([
        record.employee_no,
        `"${record.employee_name}"`,
        `"${record.bank_name}"`,
        record.branch_code,
        record.account_number,
        record.account_type,
        record.amount.toFixed(2),
        record.reference,
      ].join(','));
    }

    return lines.join('\n');
  }

  private formatACBHeader(header: ACBHeader): string {
    // ACB header record format (200 chars fixed width)
    return [
      header.recordId,                          // 3
      header.userCode.padStart(4, ' '),         // 4
      header.creationDate,                      // 8
      header.purgeDate,                         // 8
      header.firstActionDate,                   // 8
      header.lastActionDate,                    // 8
      header.firstSeqNo,                        // 6
      header.userGenerationNo,                  // 4
      header.typeOfService === 'SALARY' ? 'SALARYS' : 'CREDITOR', // 8
    ].join('').padEnd(200, ' ');
  }

  private formatACBTransaction(txn: ACBTransaction): string {
    // ACB transaction record format (200 chars fixed width)
    return [
      txn.recordId,                             // 3
      txn.branchCode,                           // 6
      txn.accountNumber.padStart(11, '0'),      // 11
      txn.accountType,                          // 1
      txn.amount.toString().padStart(11, '0'),  // 11
      txn.actionDate,                           // 6
      txn.entryClass,                           // 2
      txn.taxCode,                              // 1
      txn.userReference,                        // 10
      txn.homingBranch,                         // 6
      txn.homingAccount.padStart(11, '0'),      // 11
      txn.homingAccountType,                    // 1
      txn.sequenceNo,                           // 6
      txn.userName,                             // 30
      txn.homingInstitution,                    // 2
      txn.nominatedAccount.padStart(11, '0'),   // 11
    ].join('').padEnd(200, ' ');
  }

  private formatACBContra(contra: ACBContra): string {
    return [
      contra.recordId,                          // 3
      contra.branchCode,                        // 6
      contra.accountNumber.padStart(11, '0'),   // 11
      contra.accountType,                       // 1
      contra.amount.toString().padStart(11, '0'), // 11
      contra.actionDate,                        // 6
      contra.entryClass,                        // 2
      '0',                                      // Tax code
      '          ',                             // User reference (10 spaces)
      contra.homingBranch,                      // 6
      contra.sequenceNo,                        // 6
      contra.userName,                          // 30
    ].join('').padEnd(200, ' ');
  }

  private formatACBTrailer(trailer: ACBTrailer): string {
    return [
      trailer.recordId,                         // 3
      trailer.noOfRecords,                      // 6
      trailer.hashTotalOfHomingAccountNo,       // 12
      trailer.hashTotalOfHomingBranch,          // 12
    ].join('').padEnd(200, ' ');
  }

  private mapAccountType(type: string): '1' | '2' | '3' {
    switch (type.toUpperCase()) {
      case 'CHEQUE':
      case 'CURRENT':
        return '1';
      case 'SAVINGS':
        return '2';
      case 'TRANSMISSION':
        return '3';
      default:
        return '1';
    }
  }
}
