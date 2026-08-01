import {
  HcmContractorCorrelationConfidence,
  HcmContractorCorrelationMatchStatus,
  MigrationSourceSystem,
} from '@prisma/client';
import { ContractorCorrelationService } from '../contractor-correlation.service';
import { HcmContractorNormalizationService } from '../../contractor-migration/services/hcm-contractor-normalization.service';

describe('ContractorCorrelationService (PR-CTR-CONNECTOR-1C)', () => {
  const organizationId = 'org-corr-1';

  function buildService(contractors: object[]) {
    const prisma = {
      supplier: {
        findMany: jest.fn().mockResolvedValue([{ id: 'sup-1' }]),
      },
      contractor: {
        findMany: jest.fn().mockResolvedValue(contractors),
      },
    };
    return new ContractorCorrelationService(
      prisma as never,
      new HcmContractorNormalizationService(),
    );
  }

  it('returns HIGH match on legacy HCM person id', async () => {
    const service = buildService([
      {
        id: 'ctr-1',
        email: 'a@test.com',
        idNumber: null,
        legacySourcePersonId: 'HCM-100',
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        isActive: true,
      },
    ]);

    const outcome = await service.correlate({
      organizationId,
      sourcePersonId: 'HCM-100',
      sourcePayload: { person_id: 'HCM-100', email: 'other@test.com' },
    });

    expect(outcome.matchStatus).toBe(HcmContractorCorrelationMatchStatus.MATCHED);
    expect(outcome.confidence).toBe(HcmContractorCorrelationConfidence.HIGH);
    expect(outcome.proposedContractorId).toBe('ctr-1');
  });

  it('returns LOW possible match on email only', async () => {
    const service = buildService([
      {
        id: 'ctr-2',
        email: 'only@test.com',
        idNumber: null,
        legacySourcePersonId: 'OTHER',
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        isActive: true,
      },
    ]);

    const outcome = await service.correlate({
      organizationId,
      sourcePersonId: 'HCM-NEW',
      sourcePayload: { person_id: 'HCM-NEW', email: 'only@test.com' },
    });

    expect(outcome.matchStatus).toBe(
      HcmContractorCorrelationMatchStatus.POSSIBLE_MATCH,
    );
    expect(outcome.confidence).toBe(HcmContractorCorrelationConfidence.LOW);
  });
});
