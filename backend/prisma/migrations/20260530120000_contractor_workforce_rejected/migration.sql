-- PR-WORKFORCE-REVIEW-OUTCOMES-1 — intake/review rejection before workforce approval
ALTER TYPE "ContractorWorkforceState" ADD VALUE IF NOT EXISTS 'REJECTED';
