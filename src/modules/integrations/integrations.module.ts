import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { BankingIntegrationService } from './services/banking-integration.service';
import { AccountingIntegrationService } from './services/accounting-integration.service';
import { SarsEfilingService } from './services/sars-efiling.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    BankingIntegrationService,
    AccountingIntegrationService,
    SarsEfilingService,
  ],
  exports: [
    IntegrationsService,
    BankingIntegrationService,
    AccountingIntegrationService,
    SarsEfilingService,
  ],
})
export class IntegrationsModule {}
