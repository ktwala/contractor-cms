-- PDP activation control plane + exception workflow tables

CREATE TABLE "PdpActivationRule" (
    "id" TEXT NOT NULL,
    "reasonCode" TEXT,
    "action" TEXT,
    "domain" TEXT,
    "organizationId" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "enforcementLevel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "requiresDualApproval" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdpActivationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PdpActivationRule_organizationId_idx" ON "PdpActivationRule"("organizationId");
CREATE INDEX "PdpActivationRule_reasonCode_idx" ON "PdpActivationRule"("reasonCode");
CREATE INDEX "PdpActivationRule_environment_idx" ON "PdpActivationRule"("environment");

CREATE TABLE "PdpExceptionRequest" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "contextTargetId" TEXT,
    "status" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "approverId" TEXT,
    "approvalNotes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdpExceptionRequest_pkey" PRIMARY KEY ("id")
);
