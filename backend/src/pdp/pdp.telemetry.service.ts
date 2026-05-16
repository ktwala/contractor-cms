import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/database/prisma.service';

export interface PdpTelemetryResult {
  totalEvaluations: number;
  shadowBlocks: number;
  shadowHolds: number;
  approvalRequired: number;
  topReasonCodes: { reason_code: string; count: number }[];
  recentShadowDecisions: any[];
}

@Injectable()
export class PdpTelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async getTelemetry(days: number = 30): Promise<PdpTelemetryResult> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Fetch all PDP shadow evaluation logs in the time window
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'PDP_SHADOW_EVALUATION',
        createdAt: { gte: fromDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    let shadowBlocks = 0;
    let shadowHolds = 0;
    let approvalRequired = 0;
    const reasonCodeMap: Record<string, number> = {};

    for (const log of logs) {
      const metadata: any = log.metadata || {};
      const evaluatedDecision = metadata.evaluatedDecision;
      const reasonCode = metadata.reason_code;

      if (evaluatedDecision === 'BLOCK') shadowBlocks++;
      if (evaluatedDecision === 'HOLD') shadowHolds++;
      if (evaluatedDecision === 'APPROVAL_REQUIRED') approvalRequired++;

      if (reasonCode) {
        reasonCodeMap[reasonCode] = (reasonCodeMap[reasonCode] || 0) + 1;
      }
    }

    // Sort reason codes by frequency
    const topReasonCodes = Object.entries(reasonCodeMap)
      .map(([reason_code, count]) => ({ reason_code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvaluations: logs.length,
      shadowBlocks,
      shadowHolds,
      approvalRequired,
      topReasonCodes,
      recentShadowDecisions: logs.slice(0, 10),
    };
  }
}
