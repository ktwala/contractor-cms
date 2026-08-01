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
  ApiQuery,
} from '@nestjs/swagger';
import { PayPeriodsService } from './pay-periods.service';
import { GeneratePeriodsDto, GeneratePeriodsResponseDto } from './dto/generate-periods.dto';
import { ListPayPeriodsResponseDto } from './dto/pay-period-response.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ApiReasonHeader } from '../../common/decorators/api-headers.decorator';

@ApiTags('PayPeriods')
@ApiBearerAuth('bearerAuth')
@Controller('pay-groups')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayPeriodsController {
  constructor(private readonly payPeriodsService: PayPeriodsService) {}

  @Post(':pay_group_id/periods/generate')
  @Permissions('pay_period:write')
  @ApiOperation({ summary: 'Generate pay periods for a year' })
  @ApiParam({ name: 'pay_group_id', example: 'pg_za_123' })
  @ApiReasonHeader()
  @ApiResponse({ status: 200, description: 'Generated', type: GeneratePeriodsResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generatePeriods(
    @Param('pay_group_id') payGroupId: string,
    @Body() dto: GeneratePeriodsDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<GeneratePeriodsResponseDto> {
    return this.payPeriodsService.generateForYear(payGroupId, dto.year, user.sub, reason);
  }

  @Get(':pay_group_id/periods')
  @Permissions('pay_period:read')
  @ApiOperation({ summary: 'List pay periods' })
  @ApiParam({ name: 'pay_group_id', example: 'pg_za_123' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiResponse({ status: 200, description: 'OK', type: ListPayPeriodsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listPeriods(
    @Param('pay_group_id') payGroupId: string,
    @Query('year') year?: number,
  ): Promise<ListPayPeriodsResponseDto> {
    return this.payPeriodsService.listPeriods(payGroupId, year);
  }
}
