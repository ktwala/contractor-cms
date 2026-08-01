import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChangeRequestsService } from './change-requests.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ListChangeRequestsDto } from './dto/list-change-requests.dto';
import {
  ApproveChangeRequestDto,
  RejectChangeRequestDto,
  CancelChangeRequestDto,
} from './dto/review-change-request.dto';
import {
  ChangeRequestResponseDto,
  ChangeRequestListResponseDto,
} from './dto/change-request-response.dto';

@ApiTags('Change Requests')
@ApiBearerAuth()
@Controller('change-requests')
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class ChangeRequestsController {
  constructor(private readonly changeRequestsService: ChangeRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a change request for sensitive employee data' })
  @ApiResponse({ status: 201, type: ChangeRequestResponseDto })
  @RequirePermissions('change_requests:create')
  async create(
    @Body() dto: CreateChangeRequestDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.changeRequestsService.create(dto, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  @ApiOperation({ summary: 'List change requests with filters' })
  @ApiResponse({ status: 200, type: ChangeRequestListResponseDto })
  @RequirePermissions('change_requests:read')
  async findAll(@Query() query: ListChangeRequestsDto) {
    return this.changeRequestsService.findAll(query);
  }

  @Get('pending')
  @ApiOperation({ summary: 'List all pending change requests awaiting approval' })
  @ApiResponse({ status: 200, type: [ChangeRequestResponseDto] })
  @RequirePermissions('change_requests:read')
  async findPending(@Query('legal_entity_id') legalEntityId?: string) {
    return this.changeRequestsService.findPending(legalEntityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific change request by ID' })
  @ApiParam({ name: 'id', description: 'Change request ID' })
  @ApiResponse({ status: 200, type: ChangeRequestResponseDto })
  @RequirePermissions('change_requests:read')
  async findOne(@Param('id') id: string) {
    return this.changeRequestsService.findOne(id);
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending change request (maker-checker)' })
  @ApiParam({ name: 'id', description: 'Change request ID' })
  @ApiResponse({ status: 200, type: ChangeRequestResponseDto })
  @RequirePermissions('change_requests:approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveChangeRequestDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.changeRequestsService.approve(id, dto, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending change request' })
  @ApiParam({ name: 'id', description: 'Change request ID' })
  @ApiResponse({ status: 200, type: ChangeRequestResponseDto })
  @RequirePermissions('change_requests:approve')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectChangeRequestDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.changeRequestsService.reject(id, dto, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending change request (by requester)' })
  @ApiParam({ name: 'id', description: 'Change request ID' })
  @ApiResponse({ status: 200, type: ChangeRequestResponseDto })
  @RequirePermissions('change_requests:create')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelChangeRequestDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.changeRequestsService.cancel(id, dto, user.sub, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
