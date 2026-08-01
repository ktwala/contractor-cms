import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TaxTableAuthoringService } from './tax-table-authoring.service';
import {
  AuthoringDraft,
  AuthoringDiffResult,
  BracketDiffEntry,
  FieldDiffEntry,
} from './types/authoring.types';

@Injectable()
export class TaxTableAuthoringDiffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authoringService: TaxTableAuthoringService,
  ) {}

  /**
   * Compare an authoring draft against the currently effective runtime TaxTableSet.
   */
  async diffAgainstRuntime(authoringVersionId: string): Promise<AuthoringDiffResult> {
    const draft = await this.authoringService.getById(authoringVersionId);

    const runtimeSet = await this.prisma.taxTableSet.findFirst({
      where: {
        country: draft.countryCode as any,
        tableType: draft.tableType as any,
        status: 'ACTIVE',
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!runtimeSet) {
      return {
        metadataChanges: [{ field: 'runtime', previous: null, current: 'new' }],
        bracketChanges: [],
        fieldChanges: [],
        bracketsAdded: draft.brackets.length,
        bracketsRemoved: 0,
      };
    }

    const runtimeData = runtimeSet.data as any;
    return this.computeDiff(draft, runtimeData, runtimeSet);
  }

  /**
   * Compare two authoring drafts.
   */
  async diffBetweenVersions(
    versionAId: string,
    versionBId: string,
  ): Promise<AuthoringDiffResult> {
    const a = await this.authoringService.getById(versionAId);
    const b = await this.authoringService.getById(versionBId);

    const bracketChanges = this.diffBracketLists(
      a.brackets.map((br) => ({
        seqNo: br.seqNo,
        min: br.bracketFrom,
        max: br.bracketTo,
        rate: br.marginalRate,
        base_amount: br.baseTax,
      })),
      b.brackets.map((br) => ({
        seqNo: br.seqNo,
        min: br.bracketFrom,
        max: br.bracketTo,
        rate: br.marginalRate,
        base_amount: br.baseTax,
      })),
    );

    const fieldChanges = this.diffFieldLists(a.fields, b.fields);

    const metadataChanges: Array<{ field: string; previous: unknown; current: unknown }> = [];
    if (a.taxYear !== b.taxYear) {
      metadataChanges.push({ field: 'taxYear', previous: a.taxYear, current: b.taxYear });
    }
    if (a.effectiveFrom.toISOString() !== b.effectiveFrom.toISOString()) {
      metadataChanges.push({ field: 'effectiveFrom', previous: a.effectiveFrom, current: b.effectiveFrom });
    }

    return {
      metadataChanges,
      bracketChanges,
      fieldChanges,
      bracketsAdded: Math.max(0, b.brackets.length - a.brackets.length),
      bracketsRemoved: Math.max(0, a.brackets.length - b.brackets.length),
    };
  }

  private computeDiff(
    draft: AuthoringDraft,
    runtimeData: any,
    runtimeSet: any,
  ): AuthoringDiffResult {
    const metadataChanges: Array<{ field: string; previous: unknown; current: unknown }> = [];

    if (runtimeSet.taxYear !== draft.taxYear) {
      metadataChanges.push({ field: 'taxYear', previous: runtimeSet.taxYear, current: draft.taxYear });
    }

    const runtimeBrackets: Array<{ seqNo: number; min: number; max: number | null; rate: number; base_amount: number }> =
      (runtimeData.brackets ?? []).map((b: any, i: number) => ({
        seqNo: i + 1,
        min: b.min,
        max: b.max,
        rate: b.rate,
        base_amount: b.base_amount,
      }));

    const draftBrackets = draft.brackets.map((b) => ({
      seqNo: b.seqNo,
      min: b.bracketFrom,
      max: b.bracketTo,
      rate: b.marginalRate,
      base_amount: b.baseTax,
    }));

    const bracketChanges = this.diffBracketLists(runtimeBrackets, draftBrackets);

    const runtimeMeta = runtimeData.meta ?? runtimeData;
    const draftFields = draft.fields;
    const fieldChanges = this.diffFieldsAgainstMeta(runtimeMeta, draftFields);

    return {
      metadataChanges,
      bracketChanges,
      fieldChanges,
      bracketsAdded: Math.max(0, draftBrackets.length - runtimeBrackets.length),
      bracketsRemoved: Math.max(0, runtimeBrackets.length - draftBrackets.length),
    };
  }

  private diffBracketLists(
    previous: Array<{ seqNo: number; min: number; max: number | null; rate: number; base_amount: number }>,
    current: Array<{ seqNo: number; min: number; max: number | null; rate: number; base_amount: number }>,
  ): BracketDiffEntry[] {
    const changes: BracketDiffEntry[] = [];
    const maxLen = Math.max(previous.length, current.length);

    for (let i = 0; i < maxLen; i++) {
      const prev = previous[i];
      const curr = current[i];

      if (!prev) {
        changes.push({ seqNo: curr.seqNo, field: '*', previous: null, current: curr });
        continue;
      }
      if (!curr) {
        changes.push({ seqNo: prev.seqNo, field: '*', previous: prev, current: null });
        continue;
      }

      for (const key of ['min', 'max', 'rate', 'base_amount'] as const) {
        if (prev[key] !== curr[key]) {
          changes.push({ seqNo: curr.seqNo, field: key, previous: prev[key], current: curr[key] });
        }
      }
    }

    return changes;
  }

  private diffFieldLists(
    previous: Array<{ fieldCode: string; fieldValue: unknown }>,
    current: Array<{ fieldCode: string; fieldValue: unknown }>,
  ): FieldDiffEntry[] {
    const changes: FieldDiffEntry[] = [];
    const prevMap = new Map(previous.map((f) => [f.fieldCode, f.fieldValue]));
    const currMap = new Map(current.map((f) => [f.fieldCode, f.fieldValue]));

    const allCodes = new Set([...prevMap.keys(), ...currMap.keys()]);
    for (const code of allCodes) {
      const pv = prevMap.get(code);
      const cv = currMap.get(code);
      if (JSON.stringify(pv) !== JSON.stringify(cv)) {
        changes.push({ fieldCode: code, previous: pv ?? null, current: cv ?? null });
      }
    }

    return changes;
  }

  private diffFieldsAgainstMeta(
    meta: Record<string, unknown>,
    fields: Array<{ fieldCode: string; fieldValue: unknown }>,
  ): FieldDiffEntry[] {
    const changes: FieldDiffEntry[] = [];
    const fieldMap = new Map(fields.map((f) => [f.fieldCode, f.fieldValue]));

    const allKeys = new Set([...Object.keys(meta), ...fieldMap.keys()]);
    for (const key of allKeys) {
      if (key === 'brackets') continue;
      const prev = meta[key] ?? null;
      const curr = fieldMap.get(key) ?? null;
      if (JSON.stringify(prev) !== JSON.stringify(curr)) {
        changes.push({ fieldCode: key, previous: prev, current: curr });
      }
    }

    return changes;
  }
}
