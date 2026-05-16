-- PR-EXTID-EVENT-FEED-1 — org scope + failure reason for integration pull API

ALTER TABLE "IgaOutboxEvent" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "IgaOutboxEvent" ADD COLUMN "failureReason" TEXT;

CREATE INDEX "IgaOutboxEvent_organizationId_deliveryStatus_createdAt_idx"
  ON "IgaOutboxEvent"("organizationId", "deliveryStatus", "createdAt");
