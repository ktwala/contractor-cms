import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
