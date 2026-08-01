import { Injectable } from '@nestjs/common';
import { CountryStatutoryProfile } from './statutory-profile.types';
import { StatutoryProfileNotFoundError } from './statutory.errors';
import { SOUTH_AFRICA_STATUTORY_PROFILE_V1 } from './profiles/south-africa/south-africa-statutory.profile';
import { LESOTHO_STATUTORY_PROFILE_V1 } from './profiles/lesotho/lesotho-statutory.profile';

@Injectable()
export class StatutoryProfileRegistry {
  private readonly profiles = new Map<string, CountryStatutoryProfile>();

  constructor() {
    this.register(SOUTH_AFRICA_STATUTORY_PROFILE_V1);
    this.register(LESOTHO_STATUTORY_PROFILE_V1);
  }

  register(profile: CountryStatutoryProfile): void {
    this.profiles.set(profile.country_code, profile);
  }

  get(countryCode: string): CountryStatutoryProfile {
    const profile = this.profiles.get(countryCode);
    if (!profile) {
      throw new StatutoryProfileNotFoundError(countryCode);
    }
    return profile;
  }

  has(countryCode: string): boolean {
    return this.profiles.has(countryCode);
  }
}
