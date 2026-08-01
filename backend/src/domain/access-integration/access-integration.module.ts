import { Module } from '@nestjs/common';
import { IgaModule } from '../../core/iga/iga.module';
import { AccessIntegrationPublishService } from './access-integration-publish.service';
import { AccessIntegrationWorkforceReactionService } from './access-integration-workforce-reaction.service';

/** CAP-ACCESS-INTEGRATION — gateway publish boundary (transport only; no workforce mutations). */
@Module({
  imports: [IgaModule],
  providers: [
    AccessIntegrationPublishService,
    AccessIntegrationWorkforceReactionService,
  ],
  exports: [AccessIntegrationPublishService, AccessIntegrationWorkforceReactionService],
})
export class AccessIntegrationModule {}
