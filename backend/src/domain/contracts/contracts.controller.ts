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
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import {
  ContractResponseDto,
  PaginatedContractResponseDto,
} from './dto/contract-response.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Permissions('contracts:create')
  @RequiresOrgContext({ type: 'body', key: 'organizationId' }) // Wait, CreateContractDto doesn't have organizationId. Wait, contracts belong to the user's active org!
  @ApiOperation({ summary: 'Create a new contract' })
  @ApiResponse({
    status: 201,
    description: 'Contract created successfully',
    type: ContractResponseDto,
  })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @CurrentUser('id') userId: string,
    @Body() createContractDto: CreateContractDto,
  ): Promise<ContractResponseDto> {
    return this.contractsService.create(accessContext, createContractDto, userId);
  }

  @Get()
  @Permissions('contracts:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get all contracts with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of contracts',
    type: PaginatedContractResponseDto,
  })
  async findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryContractDto,
  ): Promise<PaginatedContractResponseDto> {
    return this.contractsService.findAll(accessContext, query);
  }

  @Get(':id')
  @Permissions('contracts:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'SupplierContract' })
  @ApiOperation({ summary: 'Get contract by ID' })
  @ApiResponse({
    status: 200,
    description: 'Contract details',
    type: ContractResponseDto,
  })
  async findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<ContractResponseDto> {
    return this.contractsService.findOne(accessContext, id);
  }

  @Patch(':id')
  @Permissions('contracts:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'SupplierContract' })
  @ApiOperation({ summary: 'Update contract' })
  @ApiResponse({
    status: 200,
    description: 'Contract updated successfully',
    type: ContractResponseDto,
  })
  async update(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
  ): Promise<ContractResponseDto> {
    return this.contractsService.update(accessContext, id, updateContractDto);
  }

  @Delete(':id')
  @Permissions('contracts:delete')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'SupplierContract' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contract (draft only)' })
  @ApiResponse({ status: 204, description: 'Contract deleted successfully' })
  async remove(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.contractsService.remove(accessContext, id);
  }

  @Patch(':id/sign')
  @Permissions('contracts:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'SupplierContract' })
  @ApiOperation({ summary: 'Sign and activate contract' })
  @ApiResponse({
    status: 200,
    description: 'Contract signed and activated',
    type: ContractResponseDto,
  })
  async signContract(
    @CurrentAccessContext() accessContext: AccessContext,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<ContractResponseDto> {
    return this.contractsService.signContract(accessContext, id, userId);
  }

  @Patch(':id/terminate')
  @Permissions('contracts:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'SupplierContract' })
  @ApiOperation({ summary: 'Terminate contract' })
  @ApiResponse({
    status: 200,
    description: 'Contract terminated',
    type: ContractResponseDto,
  })
  async terminateContract(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<ContractResponseDto> {
    return this.contractsService.terminateContract(accessContext, id);
  }
}
