import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { QueryOracleStagingDto } from './dto/query-oracle-staging.dto';
import {
  OracleStagingRowDto,
  PaginatedOracleStagingResponseDto,
} from './dto/oracle-staging-response.dto';
import { SupplierStagingReadService } from './supplier-staging-read.service';

@Injectable()
export class OracleSupplierImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stagingRead: SupplierStagingReadService,
  ) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  async listStagingRowsByIds(
    accessContext: AccessContext,
    stagingIds: string[],
  ): Promise<OracleStagingRowDto[]> {
    return this.stagingRead.listStagingRowsByIds(accessContext, stagingIds);
  }

  async listStaging(
    accessContext: AccessContext,
    query: QueryOracleStagingDto,
  ): Promise<PaginatedOracleStagingResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const where = this.stagingRead.listWhere(organizationId, {
      matchStatus: query.matchStatus,
    });

    const [records, total] = await Promise.all([
      this.prisma.supplierSourceStaging.findMany({
        where,
        include: this.stagingRead.stagingListInclude(),
        orderBy: [{ matchStatus: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supplierSourceStaging.count({ where }),
    ]);

    const data = await Promise.all(
      records.map((r) => this.stagingRead.presentStagingRow(r)),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
