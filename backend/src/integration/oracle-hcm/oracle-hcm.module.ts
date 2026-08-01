import { Module } from '@nestjs/common';
import { HttpOracleHcmRestClient } from './oracle-hcm-rest.client';
import { OracleHcmHealthService } from './oracle-hcm-health.service';

@Module({
  providers: [HttpOracleHcmRestClient, OracleHcmHealthService],
  exports: [HttpOracleHcmRestClient, OracleHcmHealthService],
})
export class OracleHcmModule {}
