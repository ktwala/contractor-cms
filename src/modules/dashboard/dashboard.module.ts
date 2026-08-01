import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SetupModule } from '../setup/setup.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';

@Module({
  imports: [SetupModule, HierarchyModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
