import { Module } from '@nestjs/common';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { ApprovalRoutingController } from './approval-routing.controller';
import { ApprovalRoutingService } from './approval-routing.service';

@Module({
  imports: [HierarchyModule],
  controllers: [ApprovalRoutingController],
  providers: [ApprovalRoutingService],
  exports: [ApprovalRoutingService],
})
export class ApprovalRoutingModule {}
