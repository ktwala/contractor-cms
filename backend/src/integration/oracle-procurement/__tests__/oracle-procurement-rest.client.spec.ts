import { ConfigService } from '@nestjs/config';
import { HttpOracleProcurementRestClient } from '../oracle-procurement-rest.client';

describe('HttpOracleProcurementRestClient (PR-CMS-CONNECTOR-1A)', () => {
  it('reports disabled when env flag is off', () => {
    const config = {
      get: (key: string) =>
        key === 'ORACLE_PROCUREMENT_REST_ENABLED' ? 'false' : undefined,
    } as ConfigService;
    const client = new HttpOracleProcurementRestClient(config);
    expect(client.isEnabled()).toBe(false);
  });

  it('testConnection returns DISABLED when not enabled', async () => {
    const config = {
      get: (key: string) =>
        key === 'ORACLE_PROCUREMENT_REST_ENABLED' ? 'false' : undefined,
    } as ConfigService;
    const client = new HttpOracleProcurementRestClient(config);
    const result = await client.testConnection({ organizationId: 'org-1' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('DISABLED');
  });
});
