import { Module } from '@nestjs/common';
import { HttpOracleProcurementRestClient } from './oracle-procurement-rest.client';

/** PR-CMS-CONNECTOR-1A — REST client only; orchestration wired in SupplierSourcesModule. */
@Module({
  providers: [HttpOracleProcurementRestClient],
  exports: [HttpOracleProcurementRestClient],
})
export class OracleProcurementModule {}
