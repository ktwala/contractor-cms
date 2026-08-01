-- Enrich validation error exports (sheet + structured details for customer-facing workbooks)
ALTER TABLE "data_import_errors" ADD COLUMN "sheet_name" TEXT;
ALTER TABLE "data_import_errors" ADD COLUMN "details_json" JSONB;
