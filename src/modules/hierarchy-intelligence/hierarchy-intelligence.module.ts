import { Module } from '@nestjs/common';
import { HierarchyIntelligenceService } from './hierarchy-intelligence.service';
import { HierarchyIntelligenceController } from './hierarchy-intelligence.controller';

@Module({
  controllers: [HierarchyIntelligenceController],
  providers: [HierarchyIntelligenceService],
  exports: [HierarchyIntelligenceService],
})
export class HierarchyIntelligenceModule {}
