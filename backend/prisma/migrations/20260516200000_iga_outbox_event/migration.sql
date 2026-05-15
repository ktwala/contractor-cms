-- PR-IGA-OUTBOX-1 — durable outbound IGA event outbox (no dispatcher / transport)

CREATE TYPE "IgaOutboxDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "IgaOutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "externalPersonId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "deliveryStatus" "IgaOutboxDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),

    CONSTRAINT "IgaOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IgaOutboxEvent_deliveryStatus_createdAt_idx" ON "IgaOutboxEvent"("deliveryStatus", "createdAt");
