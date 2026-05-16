import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
