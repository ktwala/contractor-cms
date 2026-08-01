import * as XLSX from 'xlsx';

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  headerRowIndex: number;
}

export interface ParsedWorkbook {
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
  detectedHeaders: Record<string, number>;
}

export interface WorkbookParseOptions {
  headerDetectionMode?: 'auto' | 'fixed';
  columnAliases?: Record<string, string>;
}

/**
 * Parse a multi-sheet XLSX workbook into structured sheet data.
 * Normalizes all header keys to snake_case. Drops blank rows.
 * Handles title/banner rows by auto-detecting the real header row.
 */
export function parseWorkbook(
  buffer: Buffer,
  options: WorkbookParseOptions = {},
): ParsedWorkbook {
  const { headerDetectionMode = 'auto', columnAliases } = options;
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheets: Record<string, ParsedSheet> = {};
  const detectedHeaders: Record<string, number> = {};

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      defval: '',
      raw: false,
      header: 1,
    });

    const headerIdx =
      headerDetectionMode === 'fixed' ? 0 : findHeaderRow(allRows);
    detectedHeaders[sheetName] = headerIdx + 1;

    if (headerIdx < 0 || headerIdx >= allRows.length) {
      sheets[sheetName.toLowerCase()] = {
        name: sheetName,
        headers: [],
        rows: [],
        headerRowIndex: 0,
      };
      continue;
    }

    let rawHeaders = (allRows[headerIdx] as unknown[]).map((h) =>
      normalizeHeaderKey(String(h ?? '').trim()),
    );

    if (columnAliases) {
      rawHeaders = rawHeaders.map((h) => columnAliases[h] ?? h);
    }

    const dataRows: Record<string, unknown>[] = [];
    for (let i = headerIdx + 1; i < allRows.length; i++) {
      const cells = allRows[i] as unknown[];
      const row: Record<string, unknown> = {};
      for (let c = 0; c < rawHeaders.length; c++) {
        const key = rawHeaders[c];
        if (!key) continue;
        const val = c < cells.length ? cells[c] : '';
        row[key] = val === '' ? null : val;
      }
      if (!isBlankRow(row)) dataRows.push(row);
    }

    sheets[sheetName.toLowerCase()] = {
      name: sheetName,
      headers: rawHeaders.filter(Boolean),
      rows: dataRows,
      headerRowIndex: headerIdx,
    };
  }

  return { sheetNames: wb.SheetNames, sheets, detectedHeaders };
}

/**
 * Detect the real header row by finding the first row with 2+ non-blank
 * cells that look like identifiers (not purely numeric, not `__EMPTY`).
 */
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] as unknown[])
      .map((c) => String(c ?? '').trim())
      .filter(Boolean);
    if (cells.length < 2) continue;

    const looksLikeHeaders = cells.filter(
      (c) => !/^__empty/i.test(c) && !/^\d+(\.\d+)?$/.test(c),
    );
    if (looksLikeHeaders.length >= 2) return i;
  }
  return 0;
}

/**
 * Find a sheet by name (case-insensitive).
 */
export function findSheet(
  workbook: ParsedWorkbook,
  name: string,
): ParsedSheet | undefined {
  const key = name.toLowerCase();
  return workbook.sheets[key];
}

export function normalizeHeaderKey(key: string): string {
  return key
    .trim()
    .replace(/\s+/g, '_')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/_+/g, '_');
}

export function normalizeKeys(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeaderKey(key);
    out[normalized || key] = value === '' ? null : value;
  }
  return out;
}

function isBlankRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every(
    (v) => v === null || v === undefined || String(v).trim() === '',
  );
}

export function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim().replace(/,/g, '');
  if (str === '') return null;
  const num = Number(str);
  return isNaN(num) ? null : num;
}

export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === '') return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim().toLowerCase();
  if (['true', 'yes', '1'].includes(str)) return true;
  if (['false', 'no', '0'].includes(str)) return false;
  return null;
}
