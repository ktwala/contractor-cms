-- Expand worker classification enum; remove misleading default on contractors

ALTER TYPE "WorkerClassification" ADD VALUE IF NOT EXISTS 'SUPPLIER_CONTRACTOR';
ALTER TYPE "WorkerClassification" ADD VALUE IF NOT EXISTS 'CONSULTANT';
ALTER TYPE "WorkerClassification" ADD VALUE IF NOT EXISTS 'TEMPORARY_WORKER';
ALTER TYPE "WorkerClassification" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_SERVICES';
ALTER TYPE "WorkerClassification" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TABLE "Contractor" ALTER COLUMN "workerClassification" DROP DEFAULT;
