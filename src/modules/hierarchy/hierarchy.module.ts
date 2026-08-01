import { Module } from '@nestjs/common';
import { OrgGraphService } from './org-graph.service';
import { HierarchyIntegrityService } from './hierarchy-integrity.service';
import { HierarchyController } from './hierarchy.controller';
import { HierarchyIntelligenceModule } from '../hierarchy-intelligence/hierarchy-intelligence.module';

@Module({
  imports: [HierarchyIntelligenceModule],
  controllers: [HierarchyController],
  providers: [OrgGraphService, HierarchyIntegrityService],
  exports: [OrgGraphService, HierarchyIntegrityService],
})
export class HierarchyModule {}
