import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HcmOracleRestExtractProvider } from './hcm-oracle-rest-extract.provider';
import { HttpOracleHcmRestClient } from '../../../integration/oracle-hcm/oracle-hcm-rest.client';

describe('HcmOracleRestExtractProvider (PR-CTR-4)', () => {
  let provider: HcmOracleRestExtractProvider;
  const config: Record<string, string | undefined> = {};
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HcmOracleRestExtractProvider,
        HttpOracleHcmRestClient,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => config[key],
          },
        },
      ],
    }).compile();

    provider = moduleRef.get(HcmOracleRestExtractProvider);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.keys(config).forEach((k) => delete config[k]);
  });

  it('throws when REST extract is disabled', async () => {
    config.HCM_ORACLE_REST_ENABLED = 'false';
    await expect(
      provider.fetchContractors({ organizationId: 'org-1' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps Oracle REST items to staging extract records', async () => {
    config.HCM_ORACLE_REST_ENABLED = 'true';
    config.HCM_ORACLE_REST_BASE_URL = 'https://hcm.example.com';
    config.HCM_ORACLE_REST_USERNAME = 'integration';
    config.HCM_ORACLE_REST_PASSWORD = 'secret';
    config.HCM_ORACLE_REST_WORKERS_PATH = '/workers';

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          items: [
            {
              PersonId: 'hcm-rest-001',
              PersonNumber: 'PN-001',
              FirstName: 'Rest',
              LastName: 'Worker',
              email: 'rest@example.com',
              worker_type: 'Contingent Worker',
              sponsor_employee_id: 'cms:emp:sponsor-demo',
            },
          ],
          hasMore: false,
        }),
    });

    const records = await provider.fetchContractors({
      organizationId: 'org-1',
      since: '2024-01-01',
    });

    expect(records).toHaveLength(1);
    expect(records[0].sourcePersonId).toBe('hcm-rest-001');
    expect(records[0].sourcePayload).toMatchObject({
      person_id: 'hcm-rest-001',
      sponsor_employee_id: 'cms:emp:sponsor-demo',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://hcm.example.com/workers'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Basic '),
        }),
      }),
    );
  });

  it('follows hasMore pagination links', async () => {
    config.HCM_ORACLE_REST_ENABLED = 'true';
    config.HCM_ORACLE_REST_BASE_URL = 'https://hcm.example.com';

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            items: [{ person_id: 'p1' }],
            hasMore: true,
            links: [{ rel: 'next', href: '/workers?offset=2' }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            items: [{ person_id: 'p2' }],
            hasMore: false,
          }),
      });

    const records = await provider.fetchContractors({ organizationId: 'org-1' });
    expect(records).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
