import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
