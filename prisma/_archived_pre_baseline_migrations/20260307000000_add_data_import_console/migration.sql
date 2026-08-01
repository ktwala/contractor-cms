-- CreateEnum
CREATE TYPE "DataImportDatasetType" AS ENUM (
  'LEGAL_ENTITIES',
  'ORG_UNITS',
  'COST_CENTERS',
  'EMPLOYEES',
  'EMPLOYMENTS',
  'EMPLOYMENT_ASSIGNMENTS',
  'POSITIONS',
  'MANAGER_RELATIONSHIPS',
  'PAY_GROUPS'
);

-- CreateEnum
CREATE TYPE "DataImportStatus" AS ENUM (
  'UPLOADED',
  'PARSED',
  'VALIDATED',
  'HAS_ERRORS',
  'APPROVED',
  'PUBLISHED',
  'FAILED'
);

-- CreateEnum
CREATE TYPE "DataImportRowStatus" AS ENUM (
  'PENDING',
  'VALID',
  'INVALID',
  'PUBLISHED',
  'SKIPPED'
);

-- CreateTable
CREATE TABLE "data_import_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dataset_type" "DataImportDatasetType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_storage_path" TEXT,
    "status" "DataImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploaded_by_user_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "published_at" TIMESTAMP(3),
    "published_by_user_id" TEXT,
    "summary_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_rows" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "external_key" TEXT,
    "payload_json" JSONB NOT NULL,
    "mapped_json" JSONB,
    "status" "DataImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors_count" INTEGER NOT NULL DEFAULT 0,
    "warnings_count" INTEGER NOT NULL DEFAULT 0,
    "published_entity_type" TEXT,
    "published_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_errors" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "row_id" TEXT,
    "row_number" INTEGER,
    "field_name" TEXT,
    "error_code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_import_jobs_tenant_id_dataset_type_status_idx" ON "data_import_jobs"("tenant_id", "dataset_type", "status");

-- CreateIndex
CREATE INDEX "data_import_jobs_uploaded_by_user_id_idx" ON "data_import_jobs"("uploaded_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_import_rows_job_id_row_number_key" ON "data_import_rows"("job_id", "row_number");

-- CreateIndex
CREATE INDEX "data_import_rows_job_id_status_idx" ON "data_import_rows"("job_id", "status");

-- CreateIndex
CREATE INDEX "data_import_rows_external_key_idx" ON "data_import_rows"("external_key");

-- CreateIndex
CREATE INDEX "data_import_errors_job_id_severity_idx" ON "data_import_errors"("job_id", "severity");

-- CreateIndex
CREATE INDEX "data_import_errors_row_id_idx" ON "data_import_errors"("row_id");

-- AddForeignKey
ALTER TABLE "data_import_rows" ADD CONSTRAINT "data_import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "data_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_errors" ADD CONSTRAINT "data_import_errors_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "data_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_errors" ADD CONSTRAINT "data_import_errors_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "data_import_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
