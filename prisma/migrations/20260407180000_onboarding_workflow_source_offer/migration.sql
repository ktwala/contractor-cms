-- AlterTable
ALTER TABLE "onboarding_workflows" ADD COLUMN "source_offer_id" TEXT;
ALTER TABLE "onboarding_workflows" ADD COLUMN "source_candidate_id" TEXT;
ALTER TABLE "onboarding_workflows" ADD COLUMN "source_requisition_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_workflows_source_offer_id_key" ON "onboarding_workflows"("source_offer_id");

-- AddForeignKey
ALTER TABLE "onboarding_workflows" ADD CONSTRAINT "onboarding_workflows_source_offer_id_fkey" FOREIGN KEY ("source_offer_id") REFERENCES "job_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
