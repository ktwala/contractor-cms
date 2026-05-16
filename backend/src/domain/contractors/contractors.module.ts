import { Module } from '@nestjs/common';
import { ContractorsController } from './contractors.controller';
import { ContractorsService } from './contractors.service';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { IgaModule } from '../../core/iga/iga.module';

@Module({
  imports: [DatabaseModule, AuditModule, IgaModule],
  controllers: [ContractorsController],
  providers: [ContractorsService],
  exports: [ContractorsService],
})
export class ContractorsModule {}
