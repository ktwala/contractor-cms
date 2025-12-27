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
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import {
  InvoiceResponseDto,
  PaginatedInvoiceResponseDto,
} from './dto/invoice-response.dto';
import {
  GenerateInvoiceFromTimesheetsDto,
  ApproveInvoiceDto,
  RejectInvoiceDto,
  MarkInvoicePaidDto,
} from './dto/generate-invoice.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Permissions('invoices:create')
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully',
    type: InvoiceResponseDto,
  })
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.create(organizationId, createInvoiceDto);
  }

  @Post('generate-from-timesheets')
  @Permissions('invoices:create')
  @ApiOperation({ summary: 'Generate invoice from approved timesheets' })
  @ApiResponse({
    status: 201,
    description: 'Invoice generated successfully',
    type: InvoiceResponseDto,
  })
  async generateFromTimesheets(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: GenerateInvoiceFromTimesheetsDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.generateFromTimesheets(organizationId, dto);
  }

  @Get()
  @Permissions('invoices:read')
  @ApiOperation({ summary: 'Get all invoices with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of invoices',
    type: PaginatedInvoiceResponseDto,
  })
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: QueryInvoiceDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    return this.invoicesService.findAll(organizationId, query);
  }

  @Get(':id')
  @Permissions('invoices:read')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice details',
    type: InvoiceResponseDto,
  })
  async findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Permissions('invoices:update')
  @ApiOperation({ summary: 'Update invoice (draft only)' })
  @ApiResponse({
    status: 200,
    description: 'Invoice updated successfully',
    type: InvoiceResponseDto,
  })
  async update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.update(organizationId, id, updateInvoiceDto);
  }

  @Delete(':id')
  @Permissions('invoices:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete invoice (draft/rejected only)' })
  @ApiResponse({ status: 204, description: 'Invoice deleted successfully' })
  async remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.invoicesService.remove(organizationId, id);
  }

  @Patch(':id/submit')
  @Permissions('invoices:submit')
  @ApiOperation({ summary: 'Submit invoice for approval' })
  @ApiResponse({
    status: 200,
    description: 'Invoice submitted',
    type: InvoiceResponseDto,
  })
  async submit(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.submit(organizationId, id);
  }

  @Patch(':id/approve')
  @Permissions('invoices:approve')
  @ApiOperation({ summary: 'Approve submitted invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice approved',
    type: InvoiceResponseDto,
  })
  async approve(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() approveDto: ApproveInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.approve(organizationId, id, userId);
  }

  @Patch(':id/reject')
  @Permissions('invoices:approve')
  @ApiOperation({ summary: 'Reject submitted invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice rejected',
    type: InvoiceResponseDto,
  })
  async reject(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() rejectDto: RejectInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.reject(
      organizationId,
      id,
      rejectDto.rejectionReason,
    );
  }

  @Patch(':id/mark-paid')
  @Permissions('invoices:update')
  @ApiOperation({ summary: 'Mark invoice as paid' })
  @ApiResponse({
    status: 200,
    description: 'Invoice marked as paid',
    type: InvoiceResponseDto,
  })
  async markPaid(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: MarkInvoicePaidDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.markPaid(organizationId, id, dto);
  }

  @Patch(':id/cancel')
  @Permissions('invoices:update')
  @ApiOperation({ summary: 'Cancel invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice cancelled',
    type: InvoiceResponseDto,
  })
  async cancel(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.cancel(organizationId, id);
  }
}
