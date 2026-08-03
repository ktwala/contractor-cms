import * as XLSX from 'xlsx';
import { BootstrapImportService } from '../../bootstrap-import/bootstrap-import.service';
import { BootstrapPackParser } from '../../bootstrap-import/bootstrap-pack.parser';
import { EmployeesValidator } from '../validators/employees.validator';
import { EmploymentsValidator } from '../validators/employments.validator';

function importPrismaMock() {
  return {
    employee: { findMany: jest.fn().mockResolvedValue([{ id: 'emp-1', employeeNo: '0001' }]) },
    legalEntity: { findMany: jest.fn().mockResolvedValue([{ id: 'le-1', code: 'LPB-LS' }]) },
    payGroup: { findMany: jest.fn().mockResolvedValue([]) },
    dataImportRow: { update: jest.fn().mockResolvedValue({}) },
    dataImportError: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    dataImportJob: { update: jest.fn().mockResolvedValue({}) },
  } as any;
}

describe('HCM-first import contract', () => {
  it('does not block employments when PayGroups is absent', () => {
    const parser = new BootstrapPackParser();
    const parsed = {
      fileType: 'XLSX' as const,
      warnings: [],
      datasets: new Map<any, any>([
        ['LEGAL_ENTITIES', { source: 'book#LegalEntities', rows: [{}] }],
        ['EMPLOYEES', { source: 'book#Employees', rows: [{}] }],
        ['EMPLOYMENTS', { source: 'book#Employments', rows: [{}] }],
      ]),
    };

    const detected = parser.buildDetectedDatasets(parsed);

    expect(detected.blocked).toBe(false);
    expect(detected.missingRequired).toEqual([]);
    expect(detected.datasets.find((d) => d.datasetType === 'EMPLOYMENTS')?.status).toBe('ready');
  });

  it('validates an HCM employment without a pay group', async () => {
    const prisma = importPrismaMock();
    const validator = new EmploymentsValidator(prisma);

    const result = await validator.validate({
      id: 'job-1',
      rows: [{
        id: 'row-1',
        rowNumber: 2,
        payloadJson: {
          employee_no: '0001',
          legal_entity_code: 'LPB-LS',
          employment_type: 'PERMANENT',
          effective_from: '2020-01-01',
          effective_to: '',
        },
      }],
    });

    expect(result.errors).toBe(0);
    expect(prisma.dataImportRow.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'VALID',
        mappedJson: expect.objectContaining({ pay_group_code: undefined, effective_to: null }),
      }),
    }));
  });

  it('maps active source flags and the supplied hire date into Employee', async () => {
    const prisma = importPrismaMock();
    prisma.employee.findMany.mockResolvedValue([]);
    const validator = new EmployeesValidator(prisma);

    const result = await validator.validate({
      id: 'job-2',
      rows: [{
        id: 'row-2',
        rowNumber: 2,
        payloadJson: {
          employee_no: '0001',
          first_name: 'Mpho',
          last_name: 'Mokoena',
          legal_entity_code: 'LPB-LS',
          hire_date: '2020-01-01',
          active_in_current_month: 'Y',
        },
      }],
    });

    expect(result.errors).toBe(0);
    expect(prisma.dataImportRow.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'VALID',
        mappedJson: expect.objectContaining({ hire_date: '2020-01-01', status: 'ACTIVE' }),
      }),
    }));
  });

  it('generates headers that match the HCM and PayGroup validators', () => {
    const service = new BootstrapImportService({} as any, {} as any, {} as any, {} as any);
    const workbook = XLSX.read(service.generateWorkbookTemplate(), { type: 'buffer' });
    const rows = (sheetName: string) => XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
    })[0];

    expect(rows('Employees')).toContain('status');
    expect(rows('PayGroups')).toEqual([
      'code', 'name', 'legal_entity_code', 'country', 'currency', 'frequency',
    ]);
  });
});
