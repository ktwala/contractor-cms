-- AlterTable: add updated_at to employments for JML/IGA delta feeds (changed_since)
ALTER TABLE "employments" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: support efficient changed_since queries
CREATE INDEX IF NOT EXISTS "employments_updated_at_idx" ON "employments"("updated_at");
