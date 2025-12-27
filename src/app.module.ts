import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './core/auth/auth.module';
import { HealthController } from './core/health/health.controller';
import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './core/common/filters/http-exception.filter';
import { validateEnvironment } from './core/config/env.validation';
import appConfig from './core/config/app.config';
import databaseConfig from './core/config/database.config';
import jwtConfig from './core/config/jwt.config';
import { SuppliersModule } from './domain/suppliers/suppliers.module';
import { ContractorsModule } from './domain/contractors/contractors.module';
import { ContractsModule } from './domain/contracts/contracts.module';
import { EngagementsModule } from './domain/engagements/engagements.module';
import { TimesheetsModule } from './domain/timesheets/timesheets.module';

@Module({
  imports: [
    // Configuration with validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig, jwtConfig],
      validate: validateEnvironment,
    }),

    // Database
    DatabaseModule,

    // Authentication
    AuthModule,

    // Domain modules
    SuppliersModule,
    ContractorsModule,
    ContractsModule,
    EngagementsModule,
    TimesheetsModule,

    // Health checks
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global JWT guard (protects all routes by default)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
