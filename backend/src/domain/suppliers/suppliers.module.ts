import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
