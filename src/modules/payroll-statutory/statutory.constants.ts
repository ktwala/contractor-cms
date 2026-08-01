import { StatutoryReturnStatus } from './statutory.types';

export const RETURN_CODES = {
  EMP201: 'EMP201',
  LS_PAYE_MONTHLY: 'LS_PAYE_MONTHLY',
} as const;

export const RETURN_ITEM_CODES = {
  PAYE_TOTAL: 'PAYE_TOTAL',
  UIF_EMPLOYEE_TOTAL: 'UIF_EMPLOYEE_TOTAL',
  UIF_EMPLOYER_TOTAL: 'UIF_EMPLOYER_TOTAL',
  SDL_TOTAL: 'SDL_TOTAL',
} as const;

export const WORKFLOW_EVENTS = {
  GENERATED: 'GENERATED',
  SUBMITTED_FOR_REVIEW: 'SUBMITTED_FOR_REVIEW',
  APPROVED: 'APPROVED',
  MARKED_SUBMITTED: 'MARKED_SUBMITTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  AMENDED: 'AMENDED',
  CANCELLED: 'CANCELLED',
} as const;

export const ALLOWED_TRANSITIONS: Record<StatutoryReturnStatus, StatutoryReturnStatus[]> = {
  draft: ['under_review', 'cancelled'],
  under_review: ['approved', 'cancelled'],
  approved: ['submitted'],
  submitted: ['acknowledged', 'amended'],
  acknowledged: [],
  amended: [],
  cancelled: [],
};

export const STATUS_EVENT_MAP: Record<string, string> = {
  under_review: WORKFLOW_EVENTS.SUBMITTED_FOR_REVIEW,
  approved: WORKFLOW_EVENTS.APPROVED,
  submitted: WORKFLOW_EVENTS.MARKED_SUBMITTED,
  acknowledged: WORKFLOW_EVENTS.ACKNOWLEDGED,
  amended: WORKFLOW_EVENTS.AMENDED,
  cancelled: WORKFLOW_EVENTS.CANCELLED,
};
