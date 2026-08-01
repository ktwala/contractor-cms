import {
  Controller,
  Get,
  Post,
  Body,
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
} from '@nestjs/swagger';
import { PayGroupsService } from './pay-groups.service';
import { CreatePayGroupDto } from './dto/create-pay-group.dto';
import { PayGroupResponseDto, ListPayGroupsResponseDto } from './dto/pay-group-response.dto';
import { ListPayGroupsDto } from './dto/list-pay-groups.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ApiPayrollHeaders } from '../../common/decorators/api-headers.decorator';

@ApiTags('PayGroups')
@ApiBearerAuth('bearerAuth')
@Controller('pay-groups')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayGroupsController {
  constructor(private readonly payGroupsService: PayGroupsService) {}

  @Post()
  @Permissions('pay_group:write')
  @ApiOperation({ summary: 'Create a pay group (scoped to country + legal entity)' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 201, description: 'Created', type: PayGroupResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(
    @Body() dto: CreatePayGroupDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<PayGroupResponseDto> {
    return this.payGroupsService.create(dto, user.sub, reason);
  }

  @Get()
  @Permissions('pay_group:read')
  @ApiOperation({ summary: 'List pay groups' })
  @ApiResponse({ status: 200, description: 'OK', type: ListPayGroupsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() query: ListPayGroupsDto): Promise<ListPayGroupsResponseDto> {
    return this.payGroupsService.findAll(query);
  }
}
