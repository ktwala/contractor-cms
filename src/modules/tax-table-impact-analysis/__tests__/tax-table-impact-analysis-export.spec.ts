import { TaxTableImpactAnalysisExportService } from '../tax-table-impact-analysis-export.service';
import { TaxTableImpactAnalysisRunRepository } from '../tax-table-impact-analysis-run.repository';

describe('TaxTableImpactAnalysisExportService', () => {
  let service: TaxTableImpactAnalysisExportService;
  let mockRunRepo: any;

  beforeEach(() => {
    mockRunRepo = {
      getRun: jest.fn(),
    };
    service = new TaxTableImpactAnalysisExportService(
      mockRunRepo as unknown as TaxTableImpactAnalysisRunRepository,
    );
  });

  it('should throw when run not found', async () => {
    mockRunRepo.getRun.mockResolvedValue(null);
    await expect(service.exportCsv('missing-id')).rejects.toThrow('Impact analysis run not found');
  });

  it('should export CSV with expected columns and rows', async () => {
    mockRunRepo.getRun.mockResolvedValue({
      id: 'run-1',
      authoringVersionId: 'av-1',
      countryCode: 'ZA',
      rows: [
        {
          employeeId: 'emp-1',
          employeeNumber: 'E001',
          employeeName: 'John Doe',
          legalEntityName: 'Entity A',
          payGroupName: 'Group A',
          taxableEarnings: 50000,
          baselinePaye: 10000,
          draftPaye: 10500,
          deltaPaye: 500,
          absoluteDelta: 500,
          direction: 'INCREASE',
          baselineBracketLabel: 'Bracket 2',
          draftBracketLabel: 'Bracket 2',
        },
        {
          employeeId: 'emp-2',
          employeeNumber: 'E002',
          employeeName: 'Jane Smith',
          legalEntityName: null,
          payGroupName: null,
          taxableEarnings: 30000,
          baselinePaye: 5000,
          draftPaye: 5000,
          deltaPaye: 0,
          absoluteDelta: 0,
          direction: 'UNCHANGED',
          baselineBracketLabel: 'Bracket 1',
          draftBracketLabel: 'Bracket 1',
        },
      ],
    });

    const result = await service.exportCsv('run-1');

    expect(result.filename).toContain('ZA');
    expect(result.filename).toContain('run-1');
    expect(result.contentType).toBe('text/csv');

    const lines = result.content.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('run_id');
    expect(lines[0]).toContain('employee_name');
    expect(lines[0]).toContain('baseline_paye');
    expect(lines[1]).toContain('John Doe');
    expect(lines[2]).toContain('Jane Smith');
  });

  it('should escape CSV fields with commas', async () => {
    mockRunRepo.getRun.mockResolvedValue({
      id: 'run-2',
      authoringVersionId: 'av-2',
      countryCode: 'LS',
      rows: [
        {
          employeeId: 'emp-3',
          employeeNumber: null,
          employeeName: 'Last, First',
          legalEntityName: null,
          payGroupName: null,
          taxableEarnings: 10000,
          baselinePaye: 2000,
          draftPaye: 2100,
          deltaPaye: 100,
          absoluteDelta: 100,
          direction: 'INCREASE',
          baselineBracketLabel: null,
          draftBracketLabel: null,
        },
      ],
    });

    const result = await service.exportCsv('run-2');
    const dataRow = result.content.split('\n')[1];
    expect(dataRow).toContain('"Last, First"');
  });
});
