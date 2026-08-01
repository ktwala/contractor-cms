import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { TemplateGenerationService } from './template-generation.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PayrollController],
  providers: [PayrollService, TemplateGenerationService]
})
export class PayrollModule {}
