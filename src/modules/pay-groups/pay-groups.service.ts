import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CreatePayGroupDto } from './dto/create-pay-group.dto';
import { ListPayGroupsDto } from './dto/list-pay-groups.dto';
import { Country, Currency, COUNTRY_CURRENCY_MAP } from '../../common/dto/enums.dto';

@Injectable()
export class PayGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePayGroupDto, userId?: string, reason?: string) {
    // Validate country-currency match
    const expectedCurrency = COUNTRY_CURRENCY_MAP[dto.country];
    if (dto.currency !== expectedCurrency) {
      throw new BadRequestException({
        code: 'INVALID_CURRENCY',
        message: `Currency ${dto.currency} does not match country ${dto.country}. Expected ${expectedCurrency}`,
      });
    }

    // Verify legal entity exists and matches country
    const legalEntity = await this.prisma.legalEntity.findUnique({
      where: { id: dto.legal_entity_id },
    });

    if (!legalEntity) {
      throw new NotFoundException({
        code: 'LEGAL_ENTITY_NOT_FOUND',
        message: `Legal entity with id '${dto.legal_entity_id}' not found`,
      });
    }

    if (legalEntity.country !== dto.country) {
      throw new BadRequestException({
        code: 'COUNTRY_MISMATCH',
        message: `Pay group country (${dto.country}) must match legal entity country (${legalEntity.country})`,
      });
    }

    // Check for duplicate code
    const existing = await this.prisma.payGroup.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_CODE',
        message: `Pay group with code '${dto.code}' already exists`,
      });
    }

    const payGroup = await this.prisma.payGroup.create({
      data: {
        code: dto.code,
        name: dto.name,
        country: dto.country,
        currency: dto.currency,
        frequency: dto.frequency,
        legalEntityId: dto.legal_entity_id,
        defaultCalendar: dto.default_calendar as any,
        glDefaults: dto.gl_defaults as any,
      },
      include: {
        legalEntity: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'PayGroup',
      entityId: payGroup.id,
      newValue: payGroup as any,
      reason,
    });

    return this.mapToResponse(payGroup);
  }

  async findAll(query: ListPayGroupsDto) {
    const where: any = {};

    if (query.country) {
      where.country = query.country;
    }

    if (query.legal_entity_id) {
      where.legalEntityId = query.legal_entity_id;
    }

    const items = await this.prisma.payGroup.findMany({
      where,
      include: {
        legalEntity: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: items.map(this.mapToResponse),
    };
  }

  async findOne(id: string) {
    const payGroup = await this.prisma.payGroup.findUnique({
      where: { id },
      include: {
        legalEntity: true,
      },
    });

    if (!payGroup) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Pay group with id '${id}' not found`,
      });
    }

    return this.mapToResponse(payGroup);
  }

  private mapToResponse(payGroup: any) {
    return {
      id: payGroup.id,
      code: payGroup.code,
      name: payGroup.name,
      country: payGroup.country as Country,
      currency: payGroup.currency as Currency,
      frequency: payGroup.frequency,
      legal_entity_id: payGroup.legalEntityId,
      legalEntity: payGroup.legalEntity
        ? {
            id: payGroup.legalEntity.id,
            code: payGroup.legalEntity.code,
            name: payGroup.legalEntity.name,
            country: payGroup.legalEntity.country,
          }
        : null,
      legal_entity_name: payGroup.legalEntity?.name ?? null,
      default_calendar: payGroup.defaultCalendar,
      gl_defaults: payGroup.glDefaults,
      created_at: payGroup.createdAt.toISOString(),
    };
  }
}
