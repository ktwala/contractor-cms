import { Module } from '@nestjs/common';
import { DataImportsModule } from '../data-imports/data-imports.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { BootstrapImportController } from './bootstrap-import.controller';
import { BootstrapImportService } from './bootstrap-import.service';
import { BootstrapPackParser } from './bootstrap-pack.parser';

@Module({
  imports: [DataImportsModule, HierarchyModule],
  controllers: [BootstrapImportController],
  providers: [BootstrapImportService, BootstrapPackParser],
  exports: [BootstrapImportService],
})
export class BootstrapImportModule {}
