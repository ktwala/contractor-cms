/**
 * PR-CTR-2B — canonical shape produced by normalization (validation input).
 */
export interface NormalizedHcmContractor {
  sourcePersonId: string;
  sourcePersonNumber: string | null;
  workerType: string | null;
  displayName: string | null;
  email: string | null;
  supplier: string | null;
  businessUnit: string | null;
  department: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  responsibleManagerEmployeeId: string | null;
  assignmentStatus: string | null;
}
