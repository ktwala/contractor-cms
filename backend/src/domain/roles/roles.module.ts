import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
