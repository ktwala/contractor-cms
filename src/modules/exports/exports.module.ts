import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { DatabaseModule } from '../../core/database/database.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [DatabaseModule, EmployeesModule],
  controllers: [ExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
