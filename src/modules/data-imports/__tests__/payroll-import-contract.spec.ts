import { Test, TestingModule } from '@nestjs/testing';
import * as XLSX from 'xlsx';
import { PayrollSupplementalImportService } from '../payroll-supplemental/payroll-supplemental-import.service';
import { PayrollOpeningBalancesImportService } from '../payroll-opening-balances/payroll-opening-balances-import.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { TemplateGenerationService } from '../../payroll/template-generation.service';
import { PayrollService } from '../../payroll/payroll.service';
import { validationWorkbookToXlsx } from '../utils/export-errors';

describe('Payroll import contract', () => {
  it('grouped validation workbook still exposes standard sheet tabs', () => {
    const buf = validationWorkbookToXlsx({
      groupedRows: [
        {
          sheet: 'compensation',
          row: 2,
          field: 'employee_no',
          code: 'TEST',
          current_value: '',
          message: 'x',
          suggested_fix: 'y',
          severity: 'ERROR',
          reference_source: 'z',
        },
      ],
      referenceValues: [],
      meta: { source: 'contract-test' },
    });
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(new Set(wb.SheetNames)).toEqual(
      new Set(['Summary', 'Errors', 'Warnings', 'Reference Values', 'How to Fix']),
    );
  });

  it('supplemental precheck performs no import-job writes', async () => {
    const dataImportJobCreate = jest.fn();
    const prisma = {
      dataImportJob: { create: dataImportJobCreate, findFirst: jest.fn(), update: jest.fn() },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      payGroup: { findMany: jest.fn().mockResolvedValue([]) },
      payItem: { findMany: jest.fn().mockResolvedValue([]) },
      compensation: { findMany: jest.fn().mockResolvedValue([]) },
      bankAccount: { findMany: jest.fn().mockResolvedValue([]) },
      recurringInput: { findMany: jest.fn().mockResolvedValue([]) },
      employment: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollSupplementalImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    const svc = module.get(PayrollSupplementalImportService);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['only']]), 'wrong_sheet');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    await svc.precheck(buf);
    expect(dataImportJobCreate).not.toHaveBeenCalled();
  });

  it('opening balances precheck returns financialControl rollups', async () => {
    const prisma = {
      dataImportJob: { create: jest.fn() },
      employee: {
        findMany: jest.fn().mockResolvedValue([{ id: 'emp-1', employeeNo: 'E1', country: 'ZA' }]),
      },
      employeePayrollOpeningBalance: { findMany: jest.fn().mockResolvedValue([]) },
      payItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollOpeningBalancesImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    const svc = module.get(PayrollOpeningBalancesImportService);
    const wb = XLSX.utils.book_new();
    const cols = ['employee_no', 'tax_year', 'ytd_gross', 'ytd_taxable', 'ytd_paye', 'ytd_net'];
    const row = ['E1', 2025, 10000, 8000, 1500, 8500];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols, row]), 'payrollopeningbalances');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const res = await svc.precheck(buf, { countryCode: 'ZA', taxYear: 2025 });
    expect(res.financialControl.ytdGross).toBe(10000);
    expect(res.financialControl.ytdTaxable).toBe(8000);
    expect(res.financialControl.ytdPaye).toBe(1500);
    expect(res.financialControl.ytdNet).toBe(8500);
    expect(res.financialControl.employeeCount).toBe(1);
    expect(res.financialControl.taxYear).toBe(2025);
    expect(prisma.dataImportJob.create).not.toHaveBeenCalled();
  });

  it('tenant supplemental and opening balances templates are valid xlsx workbooks', async () => {
    const ref = {
      payGroups: ['PG1'],
      payItems: ['MED', 'BASE'],
      deductionCodes: ['MED'],
      earningComponentCodes: ['BASE'],
      payrollStatuses: ['ELIGIBLE', 'HOLD', 'EXCLUDED'],
      frequencies: ['MONTHLY'],
      currencies: ['ZAR'],
      countries: ['ZA'],
      residencyStatuses: ['RESIDENT'],
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateGenerationService,
        { provide: PayrollService, useValue: { getReferenceData: jest.fn().mockResolvedValue(ref) } },
      ],
    }).compile();

    const templates = module.get(TemplateGenerationService);
    const supp = await templates.generateSupplementalTemplate();
    const ob = await templates.generateOpeningBalancesTemplate();
    for (const label of ['supplemental', 'opening-balances']) {
      const buf = label === 'supplemental' ? supp : ob;
      expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
      const wb = XLSX.read(buf, { type: 'buffer' });
      expect(wb.SheetNames.length).toBeGreaterThan(0);
    }
    const wbSupp = XLSX.read(supp, { type: 'buffer' });
    expect(new Set(wbSupp.SheetNames)).toEqual(
      new Set(['README', '__reference_values', 'compensation', 'bankaccounts', 'recurringdeductions', 'payrolleligibility']),
    );
    const wbOb = XLSX.read(ob, { type: 'buffer' });
    expect(new Set(wbOb.SheetNames)).toEqual(new Set(['README', 'payrollopeningbalances', 'leavebalances', 'loanbalances']));
  });
});
