import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantAuthorityService } from './tenant-authority.service';

@Module({
  imports: [DatabaseModule],
  providers: [TenantAuthorityService],
  exports: [TenantAuthorityService],
})
export class AuthorityModule {}
