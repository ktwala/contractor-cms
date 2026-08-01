import { Injectable } from '@nestjs/common';
import type { NormalizedHcmContractor } from '../types/hcm-normalized-contractor.types';

function pickString(
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

function parseDateValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * PR-CTR-2B — maps raw Oracle HCM JSON to a stable validation shape.
 * Does not mutate staging or operational tables.
 */
@Injectable()
export class HcmContractorNormalizationService {
  normalize(
    sourcePayload: unknown,
    rowKeys: { sourcePersonId: string; sourcePersonNumber: string | null },
  ): NormalizedHcmContractor {
    const payload =
      sourcePayload != null && typeof sourcePayload === 'object'
        ? (sourcePayload as Record<string, unknown>)
        : {};

    const firstName = pickString(payload, [
      'first_name',
      'firstName',
      'FirstName',
      'given_name',
    ]);
    const lastName = pickString(payload, [
      'last_name',
      'lastName',
      'LastName',
      'family_name',
    ]);
    const displayName =
      pickString(payload, ['display_name', 'displayName', 'DisplayName']) ??
      ([firstName, lastName].filter(Boolean).join(' ').trim() || null);

    return {
      sourcePersonId: rowKeys.sourcePersonId,
      sourcePersonNumber:
        rowKeys.sourcePersonNumber ??
        pickString(payload, [
          'person_number',
          'personNumber',
          'PersonNumber',
          'source_person_number',
        ]),
      workerType: pickString(payload, [
        'worker_type',
        'workerType',
        'WorkerType',
        'contractor_type',
        'person_type',
        'assignment_type',
      ]),
      displayName,
      email: pickString(payload, ['email', 'Email', 'work_email', 'workEmail'])
        ?.toLowerCase() ?? null,
      supplier: pickString(payload, [
        'supplier',
        'vendor',
        'vendor_name',
        'vendorName',
        'supplier_name',
      ]),
      businessUnit: pickString(payload, [
        'business_unit',
        'businessUnit',
        'BusinessUnit',
      ]),
      department: pickString(payload, ['department', 'Department']),
      location: pickString(payload, ['location', 'Location', 'work_location']),
      startDate: parseDateValue(
        payload.start_date ??
          payload.startDate ??
          payload.assignment_start_date,
      ),
      endDate: parseDateValue(
        payload.end_date ?? payload.endDate ?? payload.assignment_end_date,
      ),
      responsibleManagerEmployeeId: pickString(payload, [
        'sponsor',
        'sponsor_employee_id',
        'responsibleManagerEmployeeId',
        'Sponsor',
        'sponsor_person_id',
      ]),
      assignmentStatus: pickString(payload, [
        'status',
        'assignment_status',
        'assignmentStatus',
        'AssignmentStatus',
      ]),
    };
  }
}
