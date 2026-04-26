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
  MarkInvoicePaidDto,
} from './dto/generate-invoice.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Permissions('invoices:create')
  @RequiresOrgContext({ type: 'body', key: 'supplierId', lookup: 'Supplier' })
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully',
    type: InvoiceResponseDto,
  })
  async create(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.create(accessContext, createInvoiceDto);
  }

  @Post('generate-from-timesheets')
  @Permissions('invoices:create')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Generate invoice from approved timesheets' })
  @ApiResponse({
    status: 201,
    description: 'Invoice generated successfully',
    type: InvoiceResponseDto,
  })
  async generateFromTimesheets(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: GenerateInvoiceFromTimesheetsDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.generateFromTimesheets(accessContext, dto);
  }

  @Get()
  @Permissions('invoices:read')
  @RequiresOrgContext({ type: 'query', key: 'organizationId' })
  @ApiOperation({ summary: 'Get all invoices with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of invoices',
    type: PaginatedInvoiceResponseDto,
  })
  async findAll(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryInvoiceDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    return this.invoicesService.findAll(accessContext, query);
  }

  @Get(':id')
  @Permissions('invoices:read')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Invoice' })
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice details',
    type: InvoiceResponseDto,
  })
  async findOne(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.findOne(accessContext, id);
  }

  @Patch(':id')
  @Permissions('invoices:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Invoice' })
  @ApiOperation({ summary: 'Update invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice updated successfully',
    type: InvoiceResponseDto,
  })
  async update(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.update(accessContext, id, updateInvoiceDto);
  }

  @Delete(':id')
  @Permissions('invoices:delete')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Invoice' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete invoice (draft only)' })
  @ApiResponse({ status: 204, description: 'Invoice deleted successfully' })
  async remove(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.invoicesService.remove(accessContext, id);
  }

  @Patch(':id/submit')
  @Permissions('invoices:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Invoice' })
  @ApiOperation({ summary: 'Submit invoice for approval' })
  @ApiResponse({
    status: 200,
    description: 'Invoice submitted',
    type: InvoiceResponseDto,
  })
  async submit(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.submit(accessContext, id);
  }

  @Patch(':id/approve')
  @Permissions('invoices:approve')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Invoice' })
  @ApiOperation({ summary: 'Approve invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice approved',
    type: InvoiceResponseDto,
  })
  async approve(
    @CurrentAccessContext() accessContext: AccessContext,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.approve(accessContext, id, userId);
  }

  @Patch(':id/reject')
  @Permissions('invoices:approve')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Invoice' })
  @ApiOperation({ summary: 'Reject invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice rejected',
    type: InvoiceResponseDto,
  })
  async reject(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason?: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.reject(accessContext, id, rejectionReason);
  }

  @Patch(':id/pay')
  @Permissions('invoices:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Invoice' })
  @ApiOperation({ summary: 'Mark invoice as paid' })
  @ApiResponse({
    status: 200,
    description: 'Invoice marked as paid',
    type: InvoiceResponseDto,
  })
  async markPaid(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
    @Body() dto: MarkInvoicePaidDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.markPaid(accessContext, id, dto);
  }

  @Patch(':id/cancel')
  @Permissions('invoices:update')
  @RequiresOrgContext({ type: 'param', key: 'id', lookup: 'Invoice' })
  @ApiOperation({ summary: 'Cancel invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice cancelled',
    type: InvoiceResponseDto,
  })
  async cancel(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('id') id: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.cancel(accessContext, id);
  }
}
