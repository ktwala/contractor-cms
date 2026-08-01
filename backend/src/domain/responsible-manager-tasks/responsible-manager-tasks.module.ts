import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { AuthModule } from '../../core/auth/auth.module';
import { ResponsibleManagerTasksController } from './responsible-manager-tasks.controller';
import { ResponsibleManagerTasksService } from './responsible-manager-tasks.service';
import { ResponsibleManagerAccountabilityInboxGuard } from './guards/responsible-manager-accountability-inbox.guard';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  controllers: [ResponsibleManagerTasksController],
  providers: [ResponsibleManagerTasksService, ResponsibleManagerAccountabilityInboxGuard],
  exports: [ResponsibleManagerTasksService],
})
export class ResponsibleManagerTasksModule {}
