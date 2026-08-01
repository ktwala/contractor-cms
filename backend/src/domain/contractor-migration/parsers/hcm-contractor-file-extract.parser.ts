import { BadRequestException, Injectable } from '@nestjs/common';
import { HcmStagingRecordAction } from '@prisma/client';
import type { HcmExtractRecord } from '../types/hcm-extract.types';

const PERSON_ID_KEYS = [
  'person_id',
  'personId',
  'PersonId',
  'source_person_id',
  'SOURCE_PERSON_ID',
];

/**
 * PR-CTR-3 — CSV / JSON file extract → staging records (no DB writes).
 */
@Injectable()
export class HcmContractorFileExtractParser {
  parseJson(content: string): HcmExtractRecord[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadRequestException('Invalid JSON extract file');
    }

    const rows = Array.isArray(parsed)
      ? parsed
      : (parsed as { records?: unknown[]; contractors?: unknown[] })?.records ??
        (parsed as { contractors?: unknown[] })?.contractors;

    if (!Array.isArray(rows)) {
      throw new BadRequestException(
        'JSON extract must be an array or { records: [] } / { contractors: [] }',
      );
    }

    return rows.map((row, index) => this.toExtractRecord(row, index + 1));
  }

  parseCsv(content: string): HcmExtractRecord[] {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV extract requires a header row and data rows');
    }

    const headers = this.parseCsvLine(lines[0]).map((h) => h.trim());
    const records: HcmExtractRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const payload: Record<string, unknown> = {};
      headers.forEach((header, col) => {
        payload[header] = values[col] ?? '';
      });
      records.push(this.toExtractRecord(payload, i + 1));
    }

    return records;
  }

  private toExtractRecord(row: unknown, rowNumber: number): HcmExtractRecord {
    if (row == null || typeof row !== 'object' || Array.isArray(row)) {
      throw new BadRequestException(`Row ${rowNumber}: expected an object`);
    }

    const payload = row as Record<string, unknown>;
    const sourcePersonId = this.resolvePersonId(payload);
    if (!sourcePersonId) {
      throw new BadRequestException(
        `Row ${rowNumber}: missing person_id / personId`,
      );
    }

    const sourcePersonNumber =
      this.pickString(payload, [
        'person_number',
        'personNumber',
        'PersonNumber',
        'source_person_number',
      ]) ?? null;

    const actionRaw = this.pickString(payload, ['record_action', 'recordAction']);
    const recordAction =
      actionRaw?.toUpperCase() === 'UPDATE'
        ? HcmStagingRecordAction.UPDATE
        : actionRaw?.toUpperCase() === 'DELETE'
          ? HcmStagingRecordAction.DELETE
          : actionRaw?.toUpperCase() === 'INSERT'
            ? HcmStagingRecordAction.INSERT
            : HcmStagingRecordAction.SNAPSHOT;

    return {
      sourcePersonId,
      sourcePersonNumber,
      sourcePayload: payload,
      recordAction,
    };
  }

  private resolvePersonId(payload: Record<string, unknown>): string | null {
    return this.pickString(payload, PERSON_ID_KEYS);
  }

  private pickString(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (value != null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return null;
  }

  /** Minimal CSV line parser (quoted fields supported). */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }
}
