import { Module } from '@nestjs/common';
import { HcmResponsibleManagerLookupService } from './hcm-responsible-manager-lookup.service';

@Module({
  providers: [HcmResponsibleManagerLookupService],
  exports: [HcmResponsibleManagerLookupService],
})
export class HcmModule {}
