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
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Permissions('contracts:create')
  @ApiOperation({ summary: 'Create a new contract' })
  @ApiResponse({
    status: 201,
    description: 'Contract created successfully',
    type: ContractResponseDto,
  })
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() createContractDto: CreateContractDto,
  ): Promise<ContractResponseDto> {
    return this.contractsService.create(organizationId, createContractDto, userId);
  }

  @Get()
  @Permissions('contracts:read')
  @ApiOperation({ summary: 'Get all contracts with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of contracts',
    type: PaginatedContractResponseDto,
  })
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: QueryContractDto,
  ): Promise<PaginatedContractResponseDto> {
    return this.contractsService.findAll(organizationId, query);
  }

  @Get(':id')
  @Permissions('contracts:read')
  @ApiOperation({ summary: 'Get contract by ID' })
  @ApiResponse({
    status: 200,
    description: 'Contract details',
    type: ContractResponseDto,
  })
  async findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<ContractResponseDto> {
    return this.contractsService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Permissions('contracts:update')
  @ApiOperation({ summary: 'Update contract' })
  @ApiResponse({
    status: 200,
    description: 'Contract updated successfully',
    type: ContractResponseDto,
  })
  async update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
  ): Promise<ContractResponseDto> {
    return this.contractsService.update(organizationId, id, updateContractDto);
  }

  @Delete(':id')
  @Permissions('contracts:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contract (draft only)' })
  @ApiResponse({ status: 204, description: 'Contract deleted successfully' })
  async remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.contractsService.remove(organizationId, id);
  }

  @Patch(':id/sign')
  @Permissions('contracts:update')
  @ApiOperation({ summary: 'Sign and activate contract' })
  @ApiResponse({
    status: 200,
    description: 'Contract signed and activated',
    type: ContractResponseDto,
  })
  async signContract(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<ContractResponseDto> {
    return this.contractsService.signContract(organizationId, id, userId);
  }

  @Patch(':id/terminate')
  @Permissions('contracts:update')
  @ApiOperation({ summary: 'Terminate contract' })
  @ApiResponse({
    status: 200,
    description: 'Contract terminated',
    type: ContractResponseDto,
  })
  async terminateContract(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<ContractResponseDto> {
    return this.contractsService.terminateContract(organizationId, id);
  }
}
