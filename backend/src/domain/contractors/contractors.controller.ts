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
import { ContractorsService } from './contractors.service';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';
import { QueryContractorDto } from './dto/query-contractor.dto';
import {
  ContractorResponseDto,
  PaginatedContractorResponseDto,
} from './dto/contractor-response.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

@ApiTags('contractors')
@Controller('contractors')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Post()
  @Permissions('contractors:create')
  @RequiresOrgContext({ type: 'body', key: 'supplierId', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Create a new contractor' })
  @ApiResponse({
    status: 201,
    description: 'Contractor created successfully',
    type: ContractorResponseDto,
  })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() createContractorDto: CreateContractorDto,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.create(accessContext, createContractorDto);
  }

  @Get()
  @Permissions('contractors:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get all contractors with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of contractors',
    type: PaginatedContractorResponseDto,
  })
  async findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryContractorDto,
  ): Promise<PaginatedContractorResponseDto> {
    return this.contractorsService.findAll(accessContext, query);
  }

  @Get(':id')
  @Permissions('contractors:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @ApiOperation({ summary: 'Get contractor by ID' })
  @ApiResponse({
    status: 200,
    description: 'Contractor details',
    type: ContractorResponseDto,
  })
  async findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.findOne(accessContext, id);
  }

  @Patch(':id')
  @Permissions('contractors:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @ApiOperation({ summary: 'Update contractor' })
  @ApiResponse({
    status: 200,
    description: 'Contractor updated successfully',
    type: ContractorResponseDto,
  })
  async update(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() updateContractorDto: UpdateContractorDto,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.update(accessContext, id, updateContractorDto);
  }

  @Delete(':id')
  @Permissions('contractors:delete')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contractor' })
  @ApiResponse({ status: 204, description: 'Contractor deleted successfully' })
  async remove(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.contractorsService.remove(accessContext, id);
  }

  @Patch(':id/deactivate')
  @Permissions('contractors:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Contractor' })
  @ApiOperation({ summary: 'Deactivate contractor' })
  @ApiResponse({
    status: 200,
    description: 'Contractor deactivated',
    type: ContractorResponseDto,
  })
  async deactivate(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.deactivate(accessContext, id);
  }
}
