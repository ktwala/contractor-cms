import { Injectable } from '@nestjs/common';
import { TaxTableAuthoringService } from './tax-table-authoring.service';
import {
  AuthoringDraft,
  SimulationInput,
  SimulationResultRow,
} from './types/authoring.types';

@Injectable()
export class TaxTableAuthoringSimulationService {
  constructor(private readonly authoringService: TaxTableAuthoringService) {}

  async simulate(
    authoringVersionId: string,
    input: SimulationInput,
  ): Promise<{
    authoringVersionId: string;
    countryCode: string;
    taxYear: string;
    results: SimulationResultRow[];
  }> {
    const draft = await this.authoringService.getById(authoringVersionId);
    const periodsPerYear = input.periodsPerYear ?? 12;

    const results: SimulationResultRow[] = input.annualIncomes.map((income) =>
      this.simulateOneIncome(draft, income, periodsPerYear, input.age),
    );

    return {
      authoringVersionId: draft.id,
      countryCode: draft.countryCode,
      taxYear: draft.taxYear,
      results,
    };
  }

  private simulateOneIncome(
    draft: AuthoringDraft,
    annualIncome: number,
    periodsPerYear: number,
    age?: number,
  ): SimulationResultRow {
    const sorted = [...draft.brackets].sort((a, b) => a.seqNo - b.seqNo);

    let annualTax = 0;
    let bracketUsed = 0;

    for (const bracket of sorted) {
      const max = bracket.bracketTo ?? Infinity;
      if (annualIncome >= bracket.bracketFrom && annualIncome <= max) {
        annualTax =
          bracket.baseTax +
          bracket.marginalRate * (annualIncome - bracket.bracketFrom);
        bracketUsed = bracket.seqNo;
        break;
      }
    }

    annualTax = this.applyCreditsAndRebates(
      draft,
      annualTax,
      age,
    );

    annualTax = Math.max(0, annualTax);

    return {
      annualIncome,
      annualTax: this.round2(annualTax),
      effectiveRate:
        annualIncome > 0
          ? this.round2((annualTax / annualIncome) * 100) / 100
          : 0,
      monthlyTax: this.round2(annualTax / periodsPerYear),
      bracketUsed,
    };
  }

  private applyCreditsAndRebates(
    draft: AuthoringDraft,
    annualTax: number,
    age?: number,
  ): number {
    const fieldMap = new Map(
      draft.fields.map((f) => [f.fieldCode, f.fieldValue]),
    );

    if (draft.countryCode === 'LS') {
      const credit = this.numericField(fieldMap, 'annual_tax_credit');
      return annualTax - credit;
    }

    if (draft.countryCode === 'ZA') {
      let rebate = this.numericField(fieldMap, 'primary_rebate');
      if (age != null && age >= 65) {
        rebate += this.numericField(fieldMap, 'secondary_rebate');
      }
      if (age != null && age >= 75) {
        rebate += this.numericField(fieldMap, 'tertiary_rebate');
      }
      return annualTax - rebate;
    }

    return annualTax;
  }

  private numericField(map: Map<string, unknown>, code: string): number {
    const val = map.get(code);
    return typeof val === 'number' ? val : 0;
  }

  private round2(x: number): number {
    return Math.round((x + Number.EPSILON) * 100) / 100;
  }
}
