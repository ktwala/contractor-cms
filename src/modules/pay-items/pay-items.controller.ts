import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { PayItemsService } from './pay-items.service';
import { CreatePayItemDto, UpdatePayItemDto } from './dto/create-pay-item.dto';
import { ListPayItemsDto } from './dto/list-pay-items.dto';
import { PayItemResponseDto, ListPayItemsResponseDto } from './dto/pay-item-response.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ApiPayrollHeaders } from '../../common/decorators/api-headers.decorator';

@ApiTags('PayItems')
@ApiBearerAuth('bearerAuth')
@Controller('pay-items')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayItemsController {
  constructor(private readonly payItemsService: PayItemsService) {}

  @Post()
  @Permissions('pay_item:write')
  @ApiOperation({ summary: 'Create a pay item (supports LS/ZA country attributes)' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 201, description: 'Created', type: PayItemResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(
    @Body() dto: CreatePayItemDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<PayItemResponseDto> {
    return this.payItemsService.create(dto, user.sub, reason);
  }

  @Get()
  @Permissions('pay_item:read')
  @ApiOperation({ summary: 'List pay items' })
  @ApiResponse({ status: 200, description: 'OK', type: ListPayItemsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() query: ListPayItemsDto): Promise<ListPayItemsResponseDto> {
    return this.payItemsService.findAll(query);
  }

  @Get(':id')
  @Permissions('pay_item:read')
  @ApiOperation({ summary: 'Get a pay item by ID' })
  @ApiParam({ name: 'id', description: 'Pay item ID' })
  @ApiResponse({ status: 200, description: 'OK', type: PayItemResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id') id: string): Promise<PayItemResponseDto> {
    return this.payItemsService.findOne(id);
  }

  @Get('code/:code')
  @Permissions('pay_item:read')
  @ApiOperation({ summary: 'Get a pay item by code' })
  @ApiParam({ name: 'code', description: 'Pay item code (e.g., BASIC, UIF)' })
  @ApiResponse({ status: 200, description: 'OK', type: PayItemResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findByCode(@Param('code') code: string): Promise<PayItemResponseDto> {
    return this.payItemsService.findByCode(code);
  }

  @Patch(':id')
  @Permissions('pay_item:write')
  @ApiOperation({ summary: 'Update a pay item' })
  @ApiParam({ name: 'id', description: 'Pay item ID' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 200, description: 'Updated', type: PayItemResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePayItemDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<PayItemResponseDto> {
    return this.payItemsService.update(id, dto, user.sub, reason);
  }

  @Delete(':id')
  @Permissions('pay_item:write')
  @ApiOperation({ summary: 'Delete or deactivate a pay item' })
  @ApiParam({ name: 'id', description: 'Pay item ID' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 200, description: 'Deleted or deactivated' })
  @ApiResponse({ status: 400, description: 'Cannot delete system pay item' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<{ deleted: boolean; deactivated: boolean; message?: string }> {
    return this.payItemsService.delete(id, user.sub, reason);
  }
}
