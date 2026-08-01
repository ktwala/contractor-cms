import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [
    AuditModule,
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
    }),
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService],
})
export class ImportsModule {}
