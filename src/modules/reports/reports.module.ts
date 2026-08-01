import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { AnalyticsController } from './analytics.controller';
import { PayslipService } from './services/payslip.service';
import { BankFileService } from './services/bank-file.service';
import { GLJournalService } from './services/gl-journal.service';
import { AnalyticsService } from './services/analytics.service';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [EmployeesModule],
  controllers: [ReportsController, AnalyticsController],
  providers: [PayslipService, BankFileService, GLJournalService, AnalyticsService],
  exports: [PayslipService, BankFileService, GLJournalService, AnalyticsService],
})
export class ReportsModule {}
