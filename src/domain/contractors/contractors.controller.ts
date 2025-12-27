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
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('contractors')
@Controller('contractors')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Post()
  @Permissions('contractors:create')
  @ApiOperation({ summary: 'Create a new contractor' })
  @ApiResponse({
    status: 201,
    description: 'Contractor created successfully',
    type: ContractorResponseDto,
  })
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createContractorDto: CreateContractorDto,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.create(organizationId, createContractorDto);
  }

  @Get()
  @Permissions('contractors:read')
  @ApiOperation({ summary: 'Get all contractors with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of contractors',
    type: PaginatedContractorResponseDto,
  })
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: QueryContractorDto,
  ): Promise<PaginatedContractorResponseDto> {
    return this.contractorsService.findAll(organizationId, query);
  }

  @Get(':id')
  @Permissions('contractors:read')
  @ApiOperation({ summary: 'Get contractor by ID' })
  @ApiResponse({
    status: 200,
    description: 'Contractor details',
    type: ContractorResponseDto,
  })
  async findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Permissions('contractors:update')
  @ApiOperation({ summary: 'Update contractor' })
  @ApiResponse({
    status: 200,
    description: 'Contractor updated successfully',
    type: ContractorResponseDto,
  })
  async update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateContractorDto: UpdateContractorDto,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.update(
      organizationId,
      id,
      updateContractorDto,
    );
  }

  @Delete(':id')
  @Permissions('contractors:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contractor' })
  @ApiResponse({ status: 204, description: 'Contractor deleted successfully' })
  async remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.contractorsService.remove(organizationId, id);
  }

  @Patch(':id/deactivate')
  @Permissions('contractors:update')
  @ApiOperation({ summary: 'Deactivate contractor' })
  @ApiResponse({
    status: 200,
    description: 'Contractor deactivated',
    type: ContractorResponseDto,
  })
  async deactivate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<ContractorResponseDto> {
    return this.contractorsService.deactivate(organizationId, id);
  }
}
