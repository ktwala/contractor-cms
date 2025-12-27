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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';
import {
  SupplierResponseDto,
  PaginatedSupplierResponseDto,
} from './dto/supplier-response.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { SupplierStatus } from '@prisma/client';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Permissions('suppliers:create')
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({
    status: 201,
    description: 'Supplier created successfully',
    type: SupplierResponseDto,
  })
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createSupplierDto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.create(organizationId, createSupplierDto);
  }

  @Get()
  @Permissions('suppliers:read')
  @ApiOperation({ summary: 'Get all suppliers with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of suppliers',
    type: PaginatedSupplierResponseDto,
  })
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: QuerySupplierDto,
  ): Promise<PaginatedSupplierResponseDto> {
    return this.suppliersService.findAll(organizationId, query);
  }

  @Get(':id')
  @Permissions('suppliers:read')
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiResponse({
    status: 200,
    description: 'Supplier details',
    type: SupplierResponseDto,
  })
  async findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Permissions('suppliers:update')
  @ApiOperation({ summary: 'Update supplier' })
  @ApiResponse({
    status: 200,
    description: 'Supplier updated successfully',
    type: SupplierResponseDto,
  })
  async update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.update(organizationId, id, updateSupplierDto);
  }

  @Delete(':id')
  @Permissions('suppliers:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete supplier' })
  @ApiResponse({ status: 204, description: 'Supplier deleted successfully' })
  async remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.suppliersService.remove(organizationId, id);
  }

  @Patch(':id/status')
  @Permissions('suppliers:update')
  @ApiOperation({ summary: 'Update supplier status' })
  @ApiResponse({
    status: 200,
    description: 'Supplier status updated',
    type: SupplierResponseDto,
  })
  async updateStatus(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body('status') status: SupplierStatus,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.updateStatus(organizationId, id, status);
  }
}
