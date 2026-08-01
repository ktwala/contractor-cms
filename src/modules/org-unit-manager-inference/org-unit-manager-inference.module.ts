import { Module } from '@nestjs/common';
import { OrgUnitManagerInferenceService } from './org-unit-manager-inference.service';
import { OrgUnitManagerInferenceController } from './org-unit-manager-inference.controller';

@Module({
  controllers: [OrgUnitManagerInferenceController],
  providers: [OrgUnitManagerInferenceService],
  exports: [OrgUnitManagerInferenceService],
})
export class OrgUnitManagerInferenceModule {}
