import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto';
import { ListLegalEntitiesDto } from './dto/list-legal-entities.dto';
import { Country } from '../../common/dto/enums.dto';

@Injectable()
export class LegalEntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateLegalEntityDto, userId?: string, reason?: string) {
    // Check for duplicate code
    const existing = await this.prisma.legalEntity.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_CODE',
        message: `Legal entity with code '${dto.code}' already exists`,
      });
    }

    const entity = await this.prisma.legalEntity.create({
      data: {
        code: dto.code,
        name: dto.name,
        country: dto.country,
        registrationNo: dto.registration_no,
        taxReference: dto.tax_reference,
        address: dto.address,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'LegalEntity',
      entityId: entity.id,
      newValue: entity as any,
      reason,
    });

    return this.mapToResponse(entity);
  }

  async findAll(query: ListLegalEntitiesDto) {
    const where: any = {};

    if (query.country) {
      where.country = query.country;
    }

    const [items, total] = await Promise.all([
      this.prisma.legalEntity.findMany({
        where,
        skip: query.offset,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.legalEntity.count({ where }),
    ]);

    return {
      items: items.map(this.mapToResponse),
      total,
      offset: query.offset || 0,
      limit: query.limit || 50,
    };
  }

  async findOne(id: string) {
    const entity = await this.prisma.legalEntity.findUnique({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Legal entity with id '${id}' not found`,
      });
    }

    return this.mapToResponse(entity);
  }

  async findByCode(code: string) {
    const entity = await this.prisma.legalEntity.findUnique({
      where: { code },
    });

    if (!entity) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Legal entity with code '${code}' not found`,
      });
    }

    return this.mapToResponse(entity);
  }

  private mapToResponse(entity: any) {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      country: entity.country as Country,
      registration_no: entity.registrationNo,
      tax_reference: entity.taxReference,
      address: entity.address,
      created_at: entity.createdAt.toISOString(),
    };
  }
}
