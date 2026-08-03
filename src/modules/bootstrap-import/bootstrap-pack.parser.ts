import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { DataImportDatasetType } from '@prisma/client';
import { parseImportFile } from '../data-imports/utils/file-parser';
import { resolveDatasetFromFilename } from '../bootstrap-pack/dto/pack-manifest.dto';
import {
  SHEET_TO_DATASET,
  DATASET_ORDER,
  DATASET_DEPENDENCIES,
  REQUIRED_BOOTSTRAP_DATASETS,
  DetectedDataset,
} from './bootstrap-import.types';

export interface ParsedPack {
  fileType: 'XLSX' | 'ZIP';
  datasets: Map<DataImportDatasetType, { source: string; rows: Record<string, unknown>[] }>;
  warnings: string[];
}

@Injectable()
export class BootstrapPackParser {
  private readonly logger = new Logger(BootstrapPackParser.name);

  parse(buffer: Buffer, fileName: string): ParsedPack {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      return this.parseXlsx(buffer, fileName);
    }
    if (ext === 'zip') {
      return this.parseZip(buffer);
    }
    throw new Error(`Unsupported file type: .${ext}. Upload an .xlsx workbook or .zip bootstrap pack.`);
  }

  private parseXlsx(buffer: Buffer, fileName: string): ParsedPack {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const datasets = new Map<DataImportDatasetType, { source: string; rows: Record<string, unknown>[] }>();
    const warnings: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const normalized = sheetName.trim().replace(/\s+/g, '_').toLowerCase();
      const datasetType = SHEET_TO_DATASET[normalized];

      if (!datasetType) {
        if (normalized !== 'instructions' && normalized !== 'readme' && normalized !== 'notes') {
          warnings.push(`Sheet "${sheetName}" does not map to a known dataset — skipping`);
        }
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      });

      const rows = rawRows.map((row) => this.normalizeKeys(row));

      if (rows.length === 0) {
        if (REQUIRED_BOOTSTRAP_DATASETS.has(datasetType)) {
          warnings.push(`Required sheet "${sheetName}" (${datasetType}) has no data rows — skipping`);
        }
        continue;
      }

      datasets.set(datasetType, { source: `${fileName}#${sheetName}`, rows });
    }

    return { fileType: 'XLSX', datasets, warnings };
  }

  private parseZip(buffer: Buffer): ParsedPack {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const datasets = new Map<DataImportDatasetType, { source: string; rows: Record<string, unknown>[] }>();
    const warnings: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const basename = entry.entryName.split('/').pop() ?? entry.entryName;

      if (basename.toLowerCase() === 'manifest.json') continue;
      if (!basename.endsWith('.csv')) {
        warnings.push(`Skipping non-CSV file: ${basename}`);
        continue;
      }

      const datasetType = resolveDatasetFromFilename(basename);
      if (!datasetType) {
        warnings.push(`Unknown dataset file: ${basename} — skipping`);
        continue;
      }

      try {
        const content = entry.getData();
        const rows = parseImportFile(content as Buffer, basename);
        if (rows.length === 0) {
          if (REQUIRED_BOOTSTRAP_DATASETS.has(datasetType as DataImportDatasetType)) {
            warnings.push(`Required dataset ${basename} (${datasetType}) has no data rows — skipping`);
          }
          continue;
        }
        datasets.set(datasetType as DataImportDatasetType, { source: basename, rows });
      } catch (e) {
        warnings.push(`Failed to parse ${basename}: ${(e as Error).message}`);
      }
    }

    return { fileType: 'ZIP', datasets, warnings };
  }

  buildDetectedDatasets(parsed: ParsedPack): { datasets: DetectedDataset[]; blocked: boolean; missingRequired: string[] } {
    const presentTypes = new Set(parsed.datasets.keys());
    const missingRequired: string[] = [];
    const blockedSets = new Set<DataImportDatasetType>();

    for (const [ds, deps] of Object.entries(DATASET_DEPENDENCIES)) {
      if (!presentTypes.has(ds as DataImportDatasetType)) continue;
      for (const dep of deps ?? []) {
        if (!presentTypes.has(dep as DataImportDatasetType)) {
          blockedSets.add(ds as DataImportDatasetType);
          missingRequired.push(`${ds} requires ${dep}`);
        }
      }
    }

    const datasets: DetectedDataset[] = DATASET_ORDER
      .filter((dt) => presentTypes.has(dt))
      .map((dt) => {
        const entry = parsed.datasets.get(dt)!;
        let status: DetectedDataset['status'] = 'ready';
        let blockReason: string | undefined;
        if (blockedSets.has(dt)) {
          status = 'blocked';
          blockReason = `Missing required dependency`;
        }
        return {
          datasetType: dt,
          source: entry.source,
          rowCount: entry.rows.length,
          status,
          blockReason,
        };
      });

    return { datasets, blocked: blockedSets.size > 0, missingRequired };
  }

  private normalizeKeys(row: Record<string, unknown>): Record<string, unknown> {
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
}
