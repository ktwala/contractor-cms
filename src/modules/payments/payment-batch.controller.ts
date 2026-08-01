import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentBatchService } from './payment-batch.service';
import { CreatePaymentBatchDto } from './dto/create-payment-batch.dto';
import { ListPaymentBatchesDto } from './dto/list-payment-batches.dto';
import { ConfirmPaymentBatchDto } from './dto/confirm-payment-batch.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('payments/batches')
export class PaymentBatchController {
  constructor(private readonly paymentBatchService: PaymentBatchService) {}

  @Get()
  @Permissions('payment_batch:read')
  async list(@Query() dto: ListPaymentBatchesDto) {
    return this.paymentBatchService.listBatches(dto);
  }

  @Get(':id')
  @Permissions('payment_batch:read')
  async get(@Param('id') id: string) {
    return this.paymentBatchService.getBatch(id);
  }

  @Post()
  @Permissions('payment_batch:create')
  async create(@Body() dto: CreatePaymentBatchDto, @Req() req: any) {
    return this.paymentBatchService.createBatch(dto, req?.user?.sub);
  }

  @Post(':id/export')
  @Permissions('payment_batch:export')
  async export(@Param('id') id: string, @Req() req: any) {
    return this.paymentBatchService.exportBatch(id, req?.user?.sub);
  }

  @Post(':id/confirm-paid')
  @Permissions('payment_batch:confirm_paid')
  async confirmPaid(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentBatchDto,
    @Req() req: any,
  ) {
    return this.paymentBatchService.confirmPaid(id, req?.user?.sub, dto);
  }
}
