import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { WorkforceIssuesService } from './workforce-issues.service';
import { WorkforceIssuesController } from './workforce-issues.controller';

@Module({
  imports: [AuditModule],
  controllers: [WorkforceIssuesController],
  providers: [WorkforceIssuesService],
  exports: [WorkforceIssuesService],
})
export class WorkforceIssuesModule {}
