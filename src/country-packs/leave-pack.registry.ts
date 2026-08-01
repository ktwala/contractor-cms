/**
 * Leave Pack Registry
 *
 * Central registry for country-specific leave management packs.
 * Provides a single point of access to get the appropriate leave pack
 * based on country code.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ICountryLeavePack } from './interfaces/leave-pack.interface';
import { ZALeavePack } from './south-africa/leave/za-leave.pack';
import { LSLeavePack } from './lesotho/leave/ls-leave.pack';

@Injectable()
export class LeavePackRegistry implements OnModuleInit {
  private readonly packs: Map<string, ICountryLeavePack> = new Map();

  constructor(
    private readonly zaLeavePack: ZALeavePack,
    private readonly lsLeavePack: LSLeavePack,
  ) {}

  onModuleInit() {
    // Register all leave packs
    this.register(this.zaLeavePack);
    this.register(this.lsLeavePack);
  }

  /**
   * Register a country leave pack
   */
  register(pack: ICountryLeavePack): void {
    this.packs.set(pack.countryCode, pack);
  }

  /**
   * Get leave pack for a specific country
   */
  get(countryCode: string): ICountryLeavePack {
    const pack = this.packs.get(countryCode.toUpperCase());
    if (!pack) {
      throw new Error(`No leave pack registered for country: ${countryCode}`);
    }
    return pack;
  }

  /**
   * Check if a leave pack exists for a country
   */
  has(countryCode: string): boolean {
    return this.packs.has(countryCode.toUpperCase());
  }

  /**
   * Get all registered country codes
   */
  getRegisteredCountries(): string[] {
    return Array.from(this.packs.keys());
  }

  /**
   * Get all registered packs
   */
  getAll(): ICountryLeavePack[] {
    return Array.from(this.packs.values());
  }
}
