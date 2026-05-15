import { Module } from '@nestjs/common';
import { HcmSponsorLookupService } from './hcm-sponsor-lookup.service';

@Module({
  providers: [HcmSponsorLookupService],
  exports: [HcmSponsorLookupService],
})
export class HcmModule {}
