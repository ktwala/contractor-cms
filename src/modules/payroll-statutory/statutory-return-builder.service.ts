import { Injectable } from '@nestjs/common';
import { PayrollEmployeeResult } from '../payroll-results/payroll-result.types';
import { CountryStatutoryProfile, StatutoryReturnDefinition } from './statutory-profile.types';
import { StatutoryReturnAggregationService } from './statutory-return-aggregation.service';
import { StatutoryReturnDto } from './statutory.types';
import * as crypto from 'crypto';

export interface PayrunContext {
  id: string;
  countryCode: string;
  legalEntityId: string;
  payGroupId?: string;
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  countryPackVersion?: string;
  status: string;
}

@Injectable()
export class StatutoryReturnBuilderService {
  constructor(
    private readonly aggregation: StatutoryReturnAggregationService,
  ) {}

  buildDraftReturnsFromPayrun(
    ctx: PayrunContext,
    results: PayrollEmployeeResult[],
    profile: CountryStatutoryProfile,
    returnCode?: string,
    userId?: string,
  ): StatutoryReturnDto[] {
    const definitions = returnCode
      ? profile.supported_returns.filter((d) => d.return_code === returnCode)
      : profile.supported_returns;

    return definitions.map((def) =>
      this.buildDraftReturn(def, ctx, results, profile, userId),
    );
  }

  private buildDraftReturn(
    definition: StatutoryReturnDefinition,
    ctx: PayrunContext,
    results: PayrollEmployeeResult[],
    profile: CountryStatutoryProfile,
    userId?: string,
  ): StatutoryReturnDto {
    const items = this.aggregation.buildItems(
      results,
      definition,
      ctx.currency,
    );

    const totalDue = items.reduce((sum, item) => sum + item.amount, 0);
    const now = new Date().toISOString();

    return {
      id: crypto.randomUUID(),
      country_code: ctx.countryCode,
      legal_entity_id: ctx.legalEntityId,
      pay_group_id: ctx.payGroupId,
      return_code: definition.return_code,
      return_label: definition.return_label,
      period_key: ctx.periodKey,
      period_start: ctx.periodStart.toISOString(),
      period_end: ctx.periodEnd.toISOString(),
      currency: ctx.currency,
      status: 'draft',
      total_due: Math.round(totalDue * 100) / 100,
      employee_count: results.length,
      source_payrun_ids: [ctx.id],
      display_schema_key: results[0]?.display_schema_key,
      statutory_profile_key: profile.profile_key,
      country_pack_version: ctx.countryPackVersion,
      generated_at: now,
      version_number: 1,
      items,
    };
  }
}
