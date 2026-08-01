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
import { RulesService } from './rules.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { ListRulesDto } from './dto/list-rules.dto';
import { RuleResponseDto, ListRulesResponseDto } from './dto/rule-response.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ApiPayrollHeaders } from '../../common/decorators/api-headers.decorator';

@ApiTags('Rules')
@ApiBearerAuth('bearerAuth')
@Controller('rules')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post()
  @Permissions('rule:write')
  @ApiOperation({ summary: 'Create a calculation rule (expression + effective dates)' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 201, description: 'Created', type: RuleResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(
    @Body() dto: CreateRuleDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<RuleResponseDto> {
    return this.rulesService.create(dto, user.sub, reason);
  }

  @Get()
  @Permissions('rule:read')
  @ApiOperation({ summary: 'List rules' })
  @ApiResponse({ status: 200, description: 'OK', type: ListRulesResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() query: ListRulesDto): Promise<ListRulesResponseDto> {
    return this.rulesService.findAll(query);
  }
}
