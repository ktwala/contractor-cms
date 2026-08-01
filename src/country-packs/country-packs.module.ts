import { Module, Global } from '@nestjs/common';
import { CountryPackRegistry } from './country-pack.registry';
import { LesothoCountryPack } from './lesotho/lesotho.pack';
import { SouthAfricaCountryPack } from './south-africa/south-africa.pack';
import { LesothoComputePack } from './lesotho/lesotho-compute.pack';
import { SouthAfricaComputePack } from './south-africa/south-africa-compute.pack';
import { TaxTableValidatorService } from './services/tax-table-validator.service';
import { PackRouterService } from './services/pack-router.service';
import { DatabaseModule } from '../core/database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    // Utility packs (tax validation, exports, etc.)
    LesothoCountryPack,
    SouthAfricaCountryPack,
    // Compute packs (payroll calculation)
    LesothoComputePack,
    SouthAfricaComputePack,
    // Services
    TaxTableValidatorService,
    PackRouterService,
    // Registry
    CountryPackRegistry,
  ],
  exports: [
    CountryPackRegistry,
    LesothoCountryPack,
    SouthAfricaCountryPack,
    LesothoComputePack,
    SouthAfricaComputePack,
    TaxTableValidatorService,
    PackRouterService,
  ],
})
export class CountryPacksModule {}
