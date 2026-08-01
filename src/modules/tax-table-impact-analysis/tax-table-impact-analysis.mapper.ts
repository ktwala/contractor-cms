import { Injectable } from '@nestjs/common';
import type { TaxBracket, TaxTableContext } from '../../country-packs/interfaces/compute-contract.interface';
import type {
  NormalizedDraftTaxTable,
  NormalizedRuntimeTaxTable,
  EmployeeTaxAnalysisBasis,
  ImpactAnalysisPerEmployeeResult,
  ImpactAnalysisComputeResult,
} from './types/tax-table-impact-analysis.types';
import type { ImpactAnalysisRowDto } from './dto/impact-analysis-response.dto';

@Injectable()
export class TaxTableImpactAnalysisMapper {
  /**
   * Map a Prisma TaxTableAuthoringVersion (with brackets + fields) into
   * the normalized draft shape used internally by the analysis engine.
   */
  mapAuthoringToNormalizedDraft(authoring: any): NormalizedDraftTaxTable {
    return {
      id: authoring.id,
      countryCode: authoring.countryCode,
      tableType: authoring.tableType,
      taxYear: authoring.taxYear,
      effectiveFrom:
        authoring.effectiveFrom instanceof Date
          ? authoring.effectiveFrom.toISOString()
          : String(authoring.effectiveFrom),
      effectiveTo: authoring.effectiveTo
        ? authoring.effectiveTo instanceof Date
          ? authoring.effectiveTo.toISOString()
          : String(authoring.effectiveTo)
        : null,
      brackets: (authoring.brackets ?? []).map((b: any) => ({
        seqNo: b.seqNo,
        fromAmount: Number(b.bracketFrom),
        toAmount: b.bracketTo == null ? null : Number(b.bracketTo),
        rate: Number(b.marginalRate),
        baseTax: Number(b.baseTax),
        isOpenEnded: !!b.isOpenEnded,
      })),
      supplemental: Object.fromEntries(
        (authoring.fields ?? []).map((f: any) => [f.fieldCode, f.fieldValueJson ?? f.fieldValue]),
      ),
    };
  }

  /**
   * Map a runtime TaxTableSet (Prisma row with JSON data) into the
   * normalized runtime shape for baseline comparison.
   */
  mapRuntimeToNormalized(runtimeSet: any): NormalizedRuntimeTaxTable {
    const data = runtimeSet.data as any;
    return {
      id: runtimeSet.id,
      taxYear: runtimeSet.taxYear,
      brackets: (data.brackets ?? []).map((b: any) => ({
        min: Number(b.min),
        max: Number(b.max),
        rate: Number(b.rate),
        base_amount: Number(b.base_amount),
      })),
      meta: data.meta ?? data,
    };
  }

  /**
   * Build a TaxTableContext (compute-pack compatible) from either
   * a runtime TaxTableSet or a draft authoring version.
   */
  buildTaxTableContext(
    source: 'runtime' | 'draft',
    runtimeTable: NormalizedRuntimeTaxTable | null,
    draftTable: NormalizedDraftTaxTable | null,
  ): TaxTableContext {
    if (source === 'runtime' && runtimeTable) {
      return {
        effective_from: '',
        brackets: runtimeTable.brackets,
        meta: runtimeTable.meta,
      };
    }

    if (source === 'draft' && draftTable) {
      const brackets: TaxBracket[] = draftTable.brackets.map((b) => ({
        min: b.fromAmount,
        max: b.toAmount ?? Infinity,
        rate: b.rate,
        base_amount: b.baseTax,
      }));

      const meta: Record<string, any> = {};
      const sup = draftTable.supplemental;

      if (draftTable.countryCode === 'ZA') {
        meta.rebates = {
          primary: this.numericSup(sup, 'primary_rebate'),
          secondary: this.numericSup(sup, 'secondary_rebate'),
          tertiary: this.numericSup(sup, 'tertiary_rebate'),
        };
        meta.mtc = {
          main_member: this.numericSup(sup, 'mtc_main_member'),
          first_dependant: this.numericSup(sup, 'mtc_first_dependant'),
          additional_dependants: this.numericSup(sup, 'mtc_additional_dependants'),
        };
        meta.uif = {
          employee_rate: this.numericSup(sup, 'uif_employee_rate'),
          monthly_ceiling: this.numericSup(sup, 'uif_monthly_ceiling'),
        };
        meta.sdl = {
          rate: this.numericSup(sup, 'sdl_rate'),
        };
      }

      if (draftTable.countryCode === 'LS') {
        meta.annual_tax_credit = this.numericSup(sup, 'annual_tax_credit');
      }

      return {
        effective_from: draftTable.effectiveFrom,
        brackets,
        meta,
      };
    }

    throw new Error('TTA_IMPACT_NO_TAX_TABLE_SOURCE');
  }

  /**
   * Compute PAYE for a single employee using bracket + rebate/credit logic.
   * This matches the compute pack mathematical model exactly.
   */
  computePaye(
    basis: EmployeeTaxAnalysisBasis,
    taxCtx: TaxTableContext,
  ): ImpactAnalysisComputeResult {
    const warnings: string[] = [];
    const taxableEarnings = basis.taxRelevantInputs.taxableEarnings;
    const annualTaxable = taxableEarnings * 12;

    const sorted = [...taxCtx.brackets].sort((a, b) => a.min - b.min);

    let annualTax = 0;
    let bracketLabel: string | null = null;

    for (const bracket of sorted) {
      const max = bracket.max === 0 ? Infinity : bracket.max;
      if (annualTaxable >= bracket.min && annualTaxable <= max) {
        annualTax =
          bracket.base_amount +
          bracket.rate * (annualTaxable - bracket.min);
        bracketLabel = `Bracket ${sorted.indexOf(bracket) + 1} (${bracket.min.toLocaleString()}–${max === Infinity ? '∞' : max.toLocaleString()})`;
        break;
      }
    }

    if (basis.countryCode === 'LS') {
      const credit = Number(taxCtx.meta?.annual_tax_credit ?? 0);
      annualTax -= credit;
    }

    if (basis.countryCode === 'ZA') {
      let rebate = Number(taxCtx.meta?.rebates?.primary ?? 0);
      const age = basis.age;
      if (age != null && age >= 65) {
        rebate += Number(taxCtx.meta?.rebates?.secondary ?? 0);
      }
      if (age != null && age >= 75) {
        rebate += Number(taxCtx.meta?.rebates?.tertiary ?? 0);
      }
      annualTax -= rebate;

      if (!taxCtx.meta?.rebates?.primary && taxCtx.meta?.rebates?.primary !== 0) {
        warnings.push('ZA primary rebate not configured — fallback to 0');
      }
    }

    annualTax = Math.max(0, annualTax);
    const monthlyPaye = Math.round((annualTax / 12) * 100) / 100;

    return { paye: monthlyPaye, bracketLabel, warnings };
  }

  toRowDto(result: ImpactAnalysisPerEmployeeResult): ImpactAnalysisRowDto {
    return {
      employeeId: result.basis.employeeId,
      employeeNumber: result.basis.employeeNumber,
      employeeName: result.basis.employeeName,
      legalEntityName: result.basis.legalEntityName,
      payGroupName: result.basis.payGroupName,
      taxableEarnings: result.basis.taxRelevantInputs.taxableEarnings,
      baselinePaye: result.baseline.paye,
      draftPaye: result.draft.paye,
      deltaPaye: result.delta.payeAmount,
      absoluteDelta: result.delta.absoluteAmount,
      direction: result.delta.direction,
      baselineBracketLabel: result.baseline.bracketLabel,
      draftBracketLabel: result.draft.bracketLabel,
    };
  }

  private numericSup(sup: Record<string, unknown>, key: string): number {
    const v = sup[key];
    return typeof v === 'number' ? v : 0;
  }
}
