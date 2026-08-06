import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HcmContractorExtractAdapter } from './hcm-contractor-extract.adapter';
import { HcmContractorFileExtractParser } from '../parsers/hcm-contractor-file-extract.parser';
import { HcmContractorStagingWriterService } from '../services/hcm-contractor-staging-writer.service';
import { HcmOracleRestExtractProvider } from '../providers/hcm-oracle-rest-extract.provider';

describe('HcmContractorExtractAdapter (PR-CTR-3)', () => {
  let adapter: HcmContractorExtractAdapter;
  let writer: {
    createBatch: jest.Mock;
    writeRecords: jest.Mock;
  };
  let oracleRest: { fetchContractors: jest.Mock };

  async function buildAdapter() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HcmContractorExtractAdapter,
        HcmContractorFileExtractParser,
        { provide: HcmContractorStagingWriterService, useValue: writer },
        { provide: HcmOracleRestExtractProvider, useValue: oracleRest },
      ],
    }).compile();
    return moduleRef.get(HcmContractorExtractAdapter);
  }

  beforeEach(async () => {
    writer = {
      createBatch: jest.fn().mockResolvedValue({ id: 'batch-abc' }),
      writeRecords: jest.fn().mockResolvedValue({
        migrationBatchId: 'batch-abc',
        organizationId: 'org-1',
        extractMode: 'FILE',
        dryRun: false,
        totalRows: 1,
        inserted: 1,
        skippedDuplicateHash: 0,
        skippedInvalid: 0,
        errors: [],
      }),
    };
    oracleRest = {
      fetchContractors: jest
        .fn()
        .mockRejectedValue(
          new ServiceUnavailableException('Oracle HCM REST extract is disabled'),
        ),
    };

    adapter = await buildAdapter();
  });

  it('ingests JSON file into staging via writer', async () => {
    const summary = await adapter.ingestFile({
      organizationId: 'org-1',
      format: 'json',
      fileName: 'workshop.json',
      content: JSON.stringify([
        {
          person_id: 'hcm-ws-1',
          person_number: 'PN-WS-1',
          email: 'ws@example.com',
          worker_type: 'Contingent Worker',
          sponsor_employee_id: 'ewp:emp:responsible-manager-1',
          start_date: '2024-01-01',
        },
      ]),
    });

    expect(writer.createBatch).toHaveBeenCalled();
    expect(writer.writeRecords).toHaveBeenCalledWith(
      expect.objectContaining({ extractMode: 'FILE', dryRun: false }),
      expect.arrayContaining([
        expect.objectContaining({ sourcePersonId: 'hcm-ws-1' }),
      ]),
    );
    expect(summary.inserted).toBe(1);
  });

  it('supports dry-run file ingest', async () => {
    writer.writeRecords.mockResolvedValueOnce({
      migrationBatchId: 'dry-run-batch-org-1',
      dryRun: true,
      inserted: 1,
      totalRows: 1,
      skippedDuplicateHash: 0,
      skippedInvalid: 0,
      errors: [],
      organizationId: 'org-1',
      extractMode: 'FILE',
    });

    await adapter.ingestFile({
      organizationId: 'org-1',
      format: 'json',
      content: JSON.stringify([{ person_id: 'hcm-1', email: 'a@b.com' }]),
      dryRun: true,
    });

    expect(writer.createBatch).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ dryRun: true }),
    );
  });

  it('Oracle REST mode is not enabled yet', async () => {
    await expect(
      adapter.ingestOracleRest({ organizationId: 'org-1' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('ingests Oracle REST rows into staging via writer', async () => {
    oracleRest.fetchContractors.mockResolvedValue([
      {
        sourcePersonId: 'hcm-rest-1',
        sourcePayload: { person_id: 'hcm-rest-1' },
      },
    ]);
    writer.writeRecords.mockResolvedValueOnce({
      migrationBatchId: 'batch-abc',
      organizationId: 'org-1',
      extractMode: 'ORACLE_REST',
      dryRun: false,
      totalRows: 1,
      inserted: 1,
      skippedDuplicateHash: 0,
      skippedInvalid: 0,
      errors: [],
    });
    adapter = await buildAdapter();

    const summary = await adapter.ingestOracleRest({
      organizationId: 'org-1',
      waveLabel: 'ORACLE_REST',
    });

    expect(oracleRest.fetchContractors).toHaveBeenCalled();
    expect(writer.writeRecords).toHaveBeenCalledWith(
      expect.objectContaining({ extractMode: 'ORACLE_REST' }),
      expect.arrayContaining([
        expect.objectContaining({ sourcePersonId: 'hcm-rest-1' }),
      ]),
    );
    expect(summary.extractMode).toBe('ORACLE_REST');
  });
});
