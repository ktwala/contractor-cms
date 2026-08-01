import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService, MetricsService } from './services';
import { MetricsController } from './controllers/metrics.controller';

/**
 * Common Module - Global utilities and services
 *
 * This module is marked as @Global() so its providers are available
 * throughout the application without needing to import the module everywhere.
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [CryptoService, MetricsService],
  exports: [CryptoService, MetricsService],
})
export class CommonModule {}
