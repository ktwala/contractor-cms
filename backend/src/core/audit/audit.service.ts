import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an action in the database and the system logger
   */
  async logAction(
    actorUserId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    before?: any,
    after?: any,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          action,
          targetType,
          targetId,
          before: before ? JSON.parse(JSON.stringify(before)) : null,
          after: after ? JSON.parse(JSON.stringify(after)) : null,
        },
      });

      this.logger.log(
        `Audit: [${action}] by User ${actorUserId || 'SYSTEM'} on ${targetType}(${targetId})`,
      );
    } catch (error) {
      // In a real system, you might want to handle this differently (e.g. alert)
      // but we shouldn't fail the primary transaction just because audit logging failed
      this.logger.error(`Failed to create audit log for ${action}`, error);
    }
  }
}
