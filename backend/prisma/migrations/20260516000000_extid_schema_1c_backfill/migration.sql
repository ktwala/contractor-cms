-- PR-EXTID-SCHEMA-1C — deterministic placeholder externalPersonId for pre-existing rows (local/CMS substrate; not HCM production identity)

UPDATE "Contractor"
SET "externalPersonId" = 'cms:backfill:' || "id"
WHERE "externalPersonId" IS NULL;
