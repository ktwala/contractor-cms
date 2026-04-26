import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrgContextOptions } from '../decorators/org-context.decorator';

@Injectable()
export class OrgContextResolverService {
  private readonly logger = new Logger(OrgContextResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        return request.body?.[key!] || null;
      }

      if (type === 'query') {
        return request.query?.[key!] || null;
      }

      if (type === 'param') {
        const paramValue = request.params?.[key!];
        
        if (!paramValue) {
          return null;
        }

        // If lookup is required, we query the DB
        if (lookup) {
          // E.g. prisma.supplier.findUnique({ where: { id: paramValue }, select: { organizationId: true } })
          const modelName = lookup.toLowerCase();
          
          if (!this.prisma[modelName]) {
            this.logger.error(`Model ${modelName} not found in Prisma Client`);
            return null;
          }

          const record = await this.prisma[modelName].findUnique({
            where: { id: paramValue },
            select: { organizationId: true },
          });

          return record?.organizationId || null;
        }

        return paramValue; // If the param itself is the org ID
      }
    } catch (error) {
      this.logger.error('Failed to resolve org context', error);
      return null;
    }

    return null;
  }
}
