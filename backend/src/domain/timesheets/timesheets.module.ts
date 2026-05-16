import { Module } from '@nestjs/common';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
