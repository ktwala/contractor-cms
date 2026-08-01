-- CreateTable
CREATE TABLE "org_units" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_org_unit_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_assignments" (
    "id" TEXT NOT NULL,
    "employment_id" TEXT NOT NULL,
    "org_unit_id" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_units_legal_entity_id_code_key" ON "org_units"("legal_entity_id", "code");

-- CreateIndex
CREATE INDEX "org_units_legal_entity_id_idx" ON "org_units"("legal_entity_id");

-- CreateIndex
CREATE INDEX "org_units_parent_org_unit_id_idx" ON "org_units"("parent_org_unit_id");

-- CreateIndex
CREATE INDEX "employment_assignments_employment_id_effective_from_idx" ON "employment_assignments"("employment_id", "effective_from");

-- CreateIndex
CREATE INDEX "employment_assignments_org_unit_id_idx" ON "employment_assignments"("org_unit_id");

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parent_org_unit_id_fkey" FOREIGN KEY ("parent_org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_assignments" ADD CONSTRAINT "employment_assignments_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_assignments" ADD CONSTRAINT "employment_assignments_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_assignments" ADD CONSTRAINT "employment_assignments_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
