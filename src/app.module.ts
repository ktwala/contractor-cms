import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from './core/database/database.module';
import { HealthController } from './core/health/health.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    DatabaseModule,

    // Health checks
    TerminusModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
