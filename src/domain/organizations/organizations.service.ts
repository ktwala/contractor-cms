import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import {
  UpdateOrganizationDto,
  UpdateOrganizationSettingsDto,
} from './dto/update-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    // Check for duplicate code
    const existingOrg = await this.prisma.organization.findUnique({
      where: {
        code: createOrganizationDto.code,
      },
    });

    if (existingOrg) {
      throw new ConflictException(
        'An organization with this code already exists',
      );
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: createOrganizationDto.name,
        code: createOrganizationDto.code,
        country: createOrganizationDto.country || 'ZA',
        currency: createOrganizationDto.currency || 'ZAR',
        timezone: createOrganizationDto.timezone || 'Africa/Johannesburg',
        hcmType: createOrganizationDto.hcmType,
        hcmConfig: createOrganizationDto.hcmConfig || {},
        isActive: true,
      },
    });

    return organization as any;
  }

  async findOne(id: string): Promise<OrganizationResponseDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            suppliers: true,
            contracts: true,
            invoices: true,
            projects: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization as any;
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      throw new NotFoundException('Organization not found');
    }

    // Check for code conflict if code is being changed
    if (
      updateOrganizationDto.code &&
      updateOrganizationDto.code !== existingOrg.code
    ) {
      const codeConflict = await this.prisma.organization.findUnique({
        where: {
          code: updateOrganizationDto.code,
        },
      });

      if (codeConflict) {
        throw new ConflictException(
          'An organization with this code already exists',
        );
      }
    }

    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        name: updateOrganizationDto.name,
        code: updateOrganizationDto.code,
        country: updateOrganizationDto.country,
        currency: updateOrganizationDto.currency,
        timezone: updateOrganizationDto.timezone,
        hcmType: updateOrganizationDto.hcmType,
        hcmConfig: updateOrganizationDto.hcmConfig,
        isActive: updateOrganizationDto.isActive,
      },
    });

    return organization as any;
  }

  async updateSettings(
    id: string,
    dto: UpdateOrganizationSettingsDto,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        hcmConfig: dto.hcmConfig,
      },
    });

    return updated as any;
  }
}
