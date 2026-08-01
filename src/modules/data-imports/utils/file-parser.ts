import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';

/**
 * Parse file (CSV or XLSX) into array of row objects.
 * Uses first row as headers; normalizes keys to snake_case.
 */
export function parseImportFile(
  buffer: Buffer,
  fileName: string,
): Record<string, unknown>[] {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return parseCsv(buffer);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(buffer);
  }

  throw new Error(`Unsupported file type: ${ext}. Use .csv or .xlsx`);
}

function parseCsv(buffer: Buffer): Record<string, unknown>[] {
  const str = buffer.toString('utf-8');
  const result = Papa.parse<Record<string, string>>(str, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV parse error: ${result.errors[0]?.message ?? 'Unknown'}`);
  }

  return (result.data ?? []).map((row) =>
    normalizeKeys(row as Record<string, unknown>),
  );
}

function parseXlsx(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file has no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  return data.map((row) => normalizeKeys(row));
}

function normalizeKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalized = key
      .trim()
      .replace(/\s+/g, '_')
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/_+/g, '_');
    out[normalized || key] = value === '' ? null : value;
  }
  return out;
}
