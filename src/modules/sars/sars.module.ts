import { Module } from '@nestjs/common';
import { SarsController } from './sars.controller';
import { SarsTaxService } from './services/sars-tax.service';
import { IRP5PdfService } from './services/irp5-pdf.service';
import { EMP201CsvService } from './services/emp201-csv.service';
import { EMP501ReconciliationService } from './services/emp501-reconciliation.service';
import { SarsValidationService } from './services/sars-validation.service';
import { BulkSubmissionService } from './services/bulk-submission.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [NotificationsModule, AuditModule],
  controllers: [SarsController],
  providers: [
    SarsTaxService,
    IRP5PdfService,
    EMP201CsvService,
    EMP501ReconciliationService,
    SarsValidationService,
    BulkSubmissionService,
  ],
  exports: [
    SarsTaxService,
    IRP5PdfService,
    EMP201CsvService,
    EMP501ReconciliationService,
    SarsValidationService,
    BulkSubmissionService,
  ],
})
export class SarsModule {}
