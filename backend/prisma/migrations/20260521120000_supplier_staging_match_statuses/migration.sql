-- PR-CMS-OPERATIONS-1D1 — add reconciliation enum values (must commit before use)

ALTER TYPE "SupplierSourceStagingMatchStatus" ADD VALUE 'NEW';
ALTER TYPE "SupplierSourceStagingMatchStatus" ADD VALUE 'POSSIBLE_MATCH';
