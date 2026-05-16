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
import { SupplierStatus } from '@prisma/client';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Permissions('suppliers:create')
  @RequiresOrgContext({ type: 'body', key: 'organizationId' })
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({
    status: 201,
    description: 'Supplier created successfully',
    type: SupplierResponseDto,
  })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() createSupplierDto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.create(accessContext, createSupplierDto);
  }

  @Get()
  @Permissions('suppliers:read', 'supplier-profile:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Get all suppliers with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of suppliers',
    type: PaginatedSupplierResponseDto,
  })
  async findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QuerySupplierDto,
  ): Promise<PaginatedSupplierResponseDto> {
    return this.suppliersService.findAll(accessContext, query);
  }

  @Get(':id')
  @Permissions('suppliers:read', 'supplier-profile:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiResponse({
    status: 200,
    description: 'Supplier details',
    type: SupplierResponseDto,
  })
  async findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.findOne(accessContext, id);
  }

  @Patch(':id')
  @Permissions('suppliers:update', 'supplier-profile:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Update supplier' })
  @ApiResponse({
    status: 200,
    description: 'Supplier updated successfully',
    type: SupplierResponseDto,
  })
  async update(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.update(accessContext, id, updateSupplierDto);
  }

  @Delete(':id')
  @Permissions('suppliers:delete')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete supplier' })
  @ApiResponse({ status: 204, description: 'Supplier deleted successfully' })
  async remove(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.suppliersService.remove(accessContext, id);
  }

  @Patch(':id/status')
  @Permissions('suppliers:update', 'supplier-profile:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Update supplier status' })
  @ApiResponse({
    status: 200,
    description: 'Supplier status updated',
    type: SupplierResponseDto,
  })
  async updateStatus(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body('status') status: SupplierStatus,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.updateStatus(accessContext, id, status);
  }
}
