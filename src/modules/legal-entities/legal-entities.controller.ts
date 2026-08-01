import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { LegalEntitiesService } from './legal-entities.service';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto';
import { LegalEntityResponseDto, PaginatedLegalEntitiesDto } from './dto/legal-entity-response.dto';
import { ListLegalEntitiesDto } from './dto/list-legal-entities.dto';
import { Permissions, AnyPermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ApiPayrollHeaders } from '../../common/decorators/api-headers.decorator';

@ApiTags('LegalEntities')
@ApiBearerAuth('bearerAuth')
@Controller('legal-entities')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class LegalEntitiesController {
  constructor(private readonly legalEntitiesService: LegalEntitiesService) {}

  @Post()
  @AnyPermissions('legal_entity:write', 'iam:legal_entities:manage')
  @ApiOperation({ summary: 'Create a legal entity (company/branch)' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 201, description: 'Created', type: LegalEntityResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Conflict - duplicate code' })
  async create(
    @Body() dto: CreateLegalEntityDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<LegalEntityResponseDto> {
    return this.legalEntitiesService.create(dto, user.sub, reason);
  }

  @Get()
  @Permissions('legal_entity:read')
  @ApiOperation({ summary: 'List legal entities' })
  @ApiResponse({ status: 200, description: 'OK', type: PaginatedLegalEntitiesDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() query: ListLegalEntitiesDto): Promise<PaginatedLegalEntitiesDto> {
    return this.legalEntitiesService.findAll(query);
  }

  @Get(':legal_entity_id')
  @Permissions('legal_entity:read')
  @ApiOperation({ summary: 'Get a legal entity' })
  @ApiParam({ name: 'legal_entity_id', example: 'le_za_001' })
  @ApiResponse({ status: 200, description: 'OK', type: LegalEntityResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('legal_entity_id') id: string): Promise<LegalEntityResponseDto> {
    return this.legalEntitiesService.findOne(id);
  }
}
