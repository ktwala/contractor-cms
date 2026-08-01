import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentsService } from './documents.service';
import { DocumentsController, DocumentSelfServiceController } from './documents.controller';
import { DocumentStorageService } from './services/document-storage.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        limits: {
          fileSize: (configService.get<number>('DOCUMENT_MAX_FILE_SIZE_MB') || 50) * 1024 * 1024,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [DocumentsController, DocumentSelfServiceController],
  providers: [DocumentsService, DocumentStorageService],
  exports: [DocumentsService, DocumentStorageService],
})
export class DocumentsModule {}
