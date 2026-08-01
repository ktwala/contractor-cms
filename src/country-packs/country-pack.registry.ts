import { Injectable, OnModuleInit } from '@nestjs/common';
import { ICountryPack, CountryPackMetadata } from './interfaces/country-pack.interface';
import { ICountryPayrollPack } from './interfaces/compute-contract.interface';
import { LesothoCountryPack } from './lesotho/lesotho.pack';
import { SouthAfricaCountryPack } from './south-africa/south-africa.pack';
import { LesothoComputePack } from './lesotho/lesotho-compute.pack';
import { SouthAfricaComputePack } from './south-africa/south-africa-compute.pack';

@Injectable()
export class CountryPackRegistry implements OnModuleInit {
  private readonly packs = new Map<string, ICountryPack>();
  private readonly computePacks = new Map<string, ICountryPayrollPack>();

  constructor(
    private readonly lesothoPack: LesothoCountryPack,
    private readonly southAfricaPack: SouthAfricaCountryPack,
    private readonly lesothoComputePack: LesothoComputePack,
    private readonly southAfricaComputePack: SouthAfricaComputePack,
  ) {}

  onModuleInit() {
    // Register utility packs (tax validation, exports, etc.)
    this.registerPack(this.lesothoPack);
    this.registerPack(this.southAfricaPack);

    // Register compute packs (payroll calculation)
    this.registerComputePack(this.lesothoComputePack);
    this.registerComputePack(this.southAfricaComputePack);
  }

  private registerPack(pack: ICountryPack): void {
    const code = pack.metadata.countryCode.toUpperCase();
    this.packs.set(code, pack);
  }

  private registerComputePack(pack: ICountryPayrollPack): void {
    const code = pack.pack_id.toUpperCase();
    this.computePacks.set(code, pack);
  }

  /**
   * Get a country pack by country code
   */
  getPack(countryCode: string): ICountryPack {
    const code = countryCode.toUpperCase();
    const pack = this.packs.get(code);

    if (!pack) {
      throw new Error(`No country pack registered for country code: ${code}`);
    }

    return pack;
  }

  /**
   * Check if a country pack exists
   */
  hasPack(countryCode: string): boolean {
    return this.packs.has(countryCode.toUpperCase());
  }

  /**
   * Get all registered country codes
   */
  getRegisteredCountries(): string[] {
    return Array.from(this.packs.keys());
  }

  /**
   * Get metadata for all registered country packs
   */
  getAllMetadata(): CountryPackMetadata[] {
    return Array.from(this.packs.values()).map(pack => pack.metadata);
  }

  /**
   * Get metadata for a specific country
   */
  getMetadata(countryCode: string): CountryPackMetadata | undefined {
    const pack = this.packs.get(countryCode.toUpperCase());
    return pack?.metadata;
  }

  /**
   * Validate a tax number for a specific country
   */
  validateTaxNumber(countryCode: string, taxNumber: string): { valid: boolean; message?: string } {
    const pack = this.getPack(countryCode);
    return pack.validateTaxNumber(taxNumber);
  }

  /**
   * Get supported currencies for a country
   */
  getSupportedCurrencies(countryCode: string): string[] {
    const metadata = this.getMetadata(countryCode);
    return metadata?.supportedCurrencies || [];
  }

  /**
   * Check if a currency is valid for a country
   */
  isCurrencyValidForCountry(countryCode: string, currency: string): boolean {
    const currencies = this.getSupportedCurrencies(countryCode);
    return currencies.includes(currency.toUpperCase());
  }

  // ============================================================================
  // Compute Pack Methods (for payroll calculation)
  // ============================================================================

  /**
   * Get a compute pack by country code
   */
  getComputePack(countryCode: string): ICountryPayrollPack {
    const code = countryCode.toUpperCase();
    const pack = this.computePacks.get(code);

    if (!pack) {
      throw new Error(`No compute pack registered for country code: ${code}`);
    }

    return pack;
  }

  /**
   * Check if a compute pack exists
   */
  hasComputePack(countryCode: string): boolean {
    return this.computePacks.has(countryCode.toUpperCase());
  }

  /**
   * Get all registered compute pack IDs
   */
  getRegisteredComputePacks(): string[] {
    return Array.from(this.computePacks.keys());
  }

  /**
   * Get compute pack version info
   */
  getComputePackVersions(): { country: string; version: string }[] {
    return Array.from(this.computePacks.entries()).map(([country, pack]) => ({
      country,
      version: pack.pack_version,
    }));
  }
}
