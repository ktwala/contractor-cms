import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
