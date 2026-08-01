import { Module } from '@nestjs/common';
import { BootstrapPackController } from './bootstrap-pack.controller';
import { BootstrapPackService } from './bootstrap-pack.service';
import { DataImportsModule } from '../data-imports/data-imports.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';

@Module({
  imports: [DataImportsModule, HierarchyModule],
  controllers: [BootstrapPackController],
  providers: [BootstrapPackService],
  exports: [BootstrapPackService],
})
export class BootstrapPackModule {}
