import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ApiKeyAuthGuard } from '../auth/guards/api-key-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ExtidEventsController } from './extid-events.controller';
import { ExtidEventsService } from './extid-events.service';
import { IntegrationPermissionsGuard } from './guards/integration-permissions.guard';
import { JwtOrApiKeyGuard } from './guards/jwt-or-api-key.guard';

@Module({
  imports: [AuditModule],
  controllers: [ExtidEventsController],
  providers: [
    ExtidEventsService,
    JwtAuthGuard,
    ApiKeyAuthGuard,
    JwtOrApiKeyGuard,
    PermissionsGuard,
    IntegrationPermissionsGuard,
  ],
})
export class ExtidModule {}
