/**
 * Shared utility functions for calculating contract validity and expiry states.
 */

export type ValidityState = 'Active' | 'Expiring Soon' | 'Expired' | 'Missing End Date';

/**
 * Returns the number of days between today (start of day) and the target date.
 * A negative number means the date has passed.
 */
export function getDaysUntilExpiry(endDate: string | Date | undefined | null): number | null {
  if (!endDate) return null;
  
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Local start of day

  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  const diffTime = endDay.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  return diffDays;
}

/**
 * Derives the validity state from an end date.
 * Uses a default threshold of 60 days for "Expiring Soon".
 */
export function getContractValidityState(endDate: string | Date | undefined | null, thresholdDays = 60): ValidityState {
  const days = getDaysUntilExpiry(endDate);
  
  if (days === null) {
    return 'Missing End Date';
  }

  if (days < 0) {
    return 'Expired';
  }

  if (days <= thresholdDays) {
    return 'Expiring Soon';
  }

  return 'Active';
}
