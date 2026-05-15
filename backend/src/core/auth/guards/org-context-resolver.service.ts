import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrgContextOptions } from '../decorators/org-context.decorator';

@Injectable()
export class OrgContextResolverService {
  private readonly logger = new Logger(OrgContextResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Resolve tenant organization id for a Prisma model + primary id (used by org-context decorator). */
  private async organizationIdForLookup(
    lookup: string,
    id: string,
  ): Promise<string | null> {
    if (lookup === 'Contractor') {
      const row = await this.prisma.contractor.findUnique({
        where: { id },
        select: { supplier: { select: { organizationId: true } } },
      });
      return row?.supplier?.organizationId ?? null;
    }

    const modelName = lookup.toLowerCase();
    if (!(this.prisma as any)[modelName]) {
      this.logger.error(`Lookup model ${lookup} not found on PrismaService`);
      return null;
    }

    const record = await (this.prisma as any)[modelName].findUnique({
      where: { id },
      select: { organizationId: true },
    });
    return record?.organizationId ?? null;
  }

  async resolveTargetOrgId(
    request: any,
    options: OrgContextOptions,
  ): Promise<string | null> {
    const { type, key, lookup } = options;

    try {
      if (type === 'currentUser') {
        return request.user?.organizationId || null;
      }

      if (type === 'body') {
        const raw = request.body?.[key!];
        if (raw == null || raw === '') {
          return null;
        }
        if (lookup) {
          return this.organizationIdForLookup(lookup, String(raw));
        }
        return typeof raw === 'string' ? raw : null;
      }

      if (type === 'query') {
        return request.query?.[key!] || null;
      }

      if (type === 'param') {
        const paramValue = request.params?.[key!];

        if (!paramValue) {
          return null;
        }

        if (lookup) {
          return this.organizationIdForLookup(lookup, String(paramValue));
        }

        return paramValue;
      }
    } catch (error) {
      this.logger.error('Failed to resolve org context', error);
      return null;
    }

    return null;
  }
}
