-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "org_unit_id" TEXT NOT NULL,
    "position_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "default_cost_center_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- Add position_id to employment_assignments
ALTER TABLE "employment_assignments" ADD COLUMN "position_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "positions_legal_entity_id_position_code_key" ON "positions"("legal_entity_id", "position_code");

-- CreateIndex
CREATE INDEX "positions_org_unit_id_idx" ON "positions"("org_unit_id");

-- CreateIndex
CREATE INDEX "positions_legal_entity_id_idx" ON "positions"("legal_entity_id");

-- CreateIndex
CREATE INDEX "positions_status_idx" ON "positions"("status");

-- CreateIndex
CREATE INDEX "employment_assignments_position_id_idx" ON "employment_assignments"("position_id");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_default_cost_center_id_fkey" FOREIGN KEY ("default_cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_assignments" ADD CONSTRAINT "employment_assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
