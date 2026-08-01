import { BadRequestException } from '@nestjs/common';
import { HcmStagingRecordAction } from '@prisma/client';
import type { HcmExtractRecord } from '../types/hcm-extract.types';

/** Flatten Oracle HCM REST worker / BI row into workshop-compatible staging payload. */
export function mapOracleWorkerToExtractRecord(
  row: Record<string, unknown>,
  rowNumber: number,
): HcmExtractRecord {
  const sourcePersonId = resolvePersonId(row);
  if (!sourcePersonId) {
    throw new BadRequestException(
      `Oracle REST row ${rowNumber}: missing PersonId / person_id`,
    );
  }

  const sourcePersonNumber =
    pickString(row, [
      'person_number',
      'personNumber',
      'PersonNumber',
      'source_person_number',
    ]) ?? null;

  const payload: Record<string, unknown> = {
    person_id: sourcePersonId,
    person_number: sourcePersonNumber,
    first_name: pickString(row, ['first_name', 'FirstName', 'givenName']),
    last_name: pickString(row, ['last_name', 'LastName', 'familyName']),
    email: pickString(row, ['email', 'Email', 'workEmail']),
    worker_type: pickString(row, [
      'worker_type',
      'WorkerType',
      'assignmentType',
      'AssignmentType',
    ]),
    start_date: pickString(row, ['start_date', 'StartDate', 'assignmentStartDate']),
    end_date: pickString(row, ['end_date', 'EndDate', 'assignmentEndDate']),
    sponsor_employee_id: pickString(row, [
      'sponsor_employee_id',
      'responsibleManagerEmployeeId',
      'SponsorEmployeeId',
      'businessSponsorId',
    ]),
    assignment_status: pickString(row, [
      'assignment_status',
      'AssignmentStatus',
      'assignmentStatus',
    ]),
    vendor_name: pickString(row, [
      'vendor_name',
      'VendorName',
      'supplierName',
      'supplier',
      'Supplier',
    ]),
    display_name: pickString(row, ['display_name', 'displayName', 'DisplayName']),
    supplier: pickString(row, ['supplier', 'Supplier', 'vendor_name', 'VendorName']),
    _oracleRest: row,
  };

  return {
    sourcePersonId,
    sourcePersonNumber,
    sourcePayload: payload,
    recordAction: HcmStagingRecordAction.SNAPSHOT,
  };
}

function resolvePersonId(row: Record<string, unknown>): string | null {
  const raw =
    row.person_id ??
    row.personId ??
    row.PersonId ??
    row.source_person_id ??
    row.SOURCE_PERSON_ID;
  if (raw == null || raw === '') return null;
  return String(raw);
}

function pickString(
  row: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

export function extractOracleRestItems(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body.filter(isObjectRow);
  }
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const candidates = obj.items ?? obj.workers ?? obj.records ?? obj.contractors;
    if (Array.isArray(candidates)) {
      return candidates.filter(isObjectRow);
    }
  }
  throw new BadRequestException(
    'Oracle REST response must be an array or { items: [] } collection',
  );
}

function isObjectRow(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
