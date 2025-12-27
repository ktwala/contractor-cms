import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { TaxClassificationService } from './tax-classification.service';
import { CreateTaxClassificationDto } from './dto/create-tax-classification.dto';
import {
  UpdateTaxClassificationDto,
  ApproveTaxClassificationDto,
} from './dto/update-tax-classification.dto';
import { QueryTaxClassificationDto } from './dto/query-tax-classification.dto';
import {
  TaxClassificationResponseDto,
  PaginatedTaxClassificationResponseDto,
} from './dto/tax-classification-response.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('tax-classifications')
@Controller('tax-classifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TaxClassificationController {
  constructor(
    private readonly taxClassificationService: TaxClassificationService,
  ) {}

  @Post()
  @Permissions('tax-classifications:create')
  @ApiOperation({ summary: 'Create a new SARS tax classification' })
  @ApiResponse({
    status: 201,
    description: 'Tax classification created successfully',
    type: TaxClassificationResponseDto,
  })
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() createDto: CreateTaxClassificationDto,
  ): Promise<TaxClassificationResponseDto> {
    return this.taxClassificationService.create(
      organizationId,
      userId,
      createDto,
    );
  }

  @Get()
  @Permissions('tax-classifications:read')
  @ApiOperation({
    summary: 'Get all tax classifications with pagination and filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tax classifications',
    type: PaginatedTaxClassificationResponseDto,
  })
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: QueryTaxClassificationDto,
  ): Promise<PaginatedTaxClassificationResponseDto> {
    return this.taxClassificationService.findAll(organizationId, query);
  }

  @Get('active/:contractorId')
  @Permissions('tax-classifications:read')
  @ApiOperation({ summary: 'Get active tax classification for contractor' })
  @ApiResponse({
    status: 200,
    description: 'Active tax classification',
    type: TaxClassificationResponseDto,
  })
  async findActive(
    @CurrentUser('organizationId') organizationId: string,
    @Param('contractorId') contractorId: string,
    @Query('engagementId') engagementId?: string,
  ): Promise<TaxClassificationResponseDto | null> {
    return this.taxClassificationService.findActiveClassification(
      organizationId,
      contractorId,
      engagementId,
    );
  }

  @Get(':id')
  @Permissions('tax-classifications:read')
  @ApiOperation({ summary: 'Get tax classification by ID' })
  @ApiResponse({
    status: 200,
    description: 'Tax classification details',
    type: TaxClassificationResponseDto,
  })
  async findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<TaxClassificationResponseDto> {
    return this.taxClassificationService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Permissions('tax-classifications:update')
  @ApiOperation({ summary: 'Update tax classification' })
  @ApiResponse({
    status: 200,
    description: 'Tax classification updated successfully',
    type: TaxClassificationResponseDto,
  })
  async update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateTaxClassificationDto,
  ): Promise<TaxClassificationResponseDto> {
    return this.taxClassificationService.update(organizationId, id, updateDto);
  }

  @Delete(':id')
  @Permissions('tax-classifications:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tax classification' })
  @ApiResponse({
    status: 204,
    description: 'Tax classification deleted successfully',
  })
  async remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.taxClassificationService.remove(organizationId, id);
  }

  @Patch(':id/approve')
  @Permissions('tax-classifications:approve')
  @ApiOperation({ summary: 'Approve tax classification' })
  @ApiResponse({
    status: 200,
    description: 'Tax classification approved',
    type: TaxClassificationResponseDto,
  })
  async approve(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() approveDto: ApproveTaxClassificationDto,
  ): Promise<TaxClassificationResponseDto> {
    return this.taxClassificationService.approve(organizationId, id, userId);
  }
}
