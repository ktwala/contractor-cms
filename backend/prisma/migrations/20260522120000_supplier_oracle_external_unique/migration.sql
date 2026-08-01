-- PR-CMS-DATA-2 — one Oracle external id per org/source (governance twin dedup)

CREATE UNIQUE INDEX "Supplier_organizationId_sourceSystem_externalSupplierId_key"
ON "Supplier"("organizationId", "sourceSystem", "externalSupplierId");
