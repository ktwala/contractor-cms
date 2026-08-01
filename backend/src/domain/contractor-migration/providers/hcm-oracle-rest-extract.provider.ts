import { Injectable } from '@nestjs/common';
import type { HcmExtractRecord } from '../types/hcm-extract.types';
import type { HcmOracleRestExtractInput } from '../types/hcm-extract.types';
import { HttpOracleHcmRestClient } from '../../../integration/oracle-hcm/oracle-hcm-rest.client';

/**
 * PR-CTR-4 / PR-CTR-CONNECTOR-1A — delegates to shared HCM REST client.
 */
@Injectable()
export class HcmOracleRestExtractProvider {
  constructor(private readonly restClient: HttpOracleHcmRestClient) {}

  isEnabled(): boolean {
    return this.restClient.isEnabled();
  }

  async fetchContractors(
    input: HcmOracleRestExtractInput,
  ): Promise<HcmExtractRecord[]> {
    const result = await this.restClient.fetchWorkers({
      organizationId: input.organizationId,
      since: input.since,
    });
    return result.records;
  }
}
