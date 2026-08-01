/** Reconciliation summary after publish (created / updated / skipped / failed) */
export type PublishSummary = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

export type PublishOutcome = 'created' | 'updated' | 'skipped' | 'failed';
