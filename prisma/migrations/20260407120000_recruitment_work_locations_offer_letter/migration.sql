-- Work location master + requisition FK + hybrid flag + offer letter URL

CREATE TABLE "work_locations" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country_code" TEXT,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "is_hybrid" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_locations_legal_entity_id_code_key" ON "work_locations"("legal_entity_id", "code");
CREATE INDEX "work_locations_legal_entity_id_idx" ON "work_locations"("legal_entity_id");

ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_requisitions" ADD COLUMN "work_location_id" TEXT,
ADD COLUMN "hybrid" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "job_requisitions_work_location_id_idx" ON "job_requisitions"("work_location_id");

ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_offers" ADD COLUMN "offer_letter_url" TEXT;

-- One default site per legal entity (dev-friendly baseline for LocationSelect)
INSERT INTO "work_locations" ("id", "legal_entity_id", "code", "name", "city", "country_code", "is_remote", "is_hybrid", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id", 'HQ', 'Head office', NULL, NULL, false, false, true, NOW(), NOW()
FROM "legal_entities";

INSERT INTO "work_locations" ("id", "legal_entity_id", "code", "name", "city", "country_code", "is_remote", "is_hybrid", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id", 'REMOTE', 'Remote', NULL, NULL, true, false, true, NOW(), NOW()
FROM "legal_entities";

INSERT INTO "work_locations" ("id", "legal_entity_id", "code", "name", "city", "country_code", "is_remote", "is_hybrid", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id", 'HYBRID', 'Hybrid', NULL, NULL, false, true, true, NOW(), NOW()
FROM "legal_entities";
