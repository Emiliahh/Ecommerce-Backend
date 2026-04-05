import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { type Webhook } from '@payos/node';
import { Public } from 'src/decorator/isPublic';
import {
  GetPaymentLogsResponseDto,
  GetPaymentQueryDto,
  PaginatedGetPaymentResponseDto,
} from './dto/get-payment.dto';
import { Roles } from 'src/decorator/role';
import { RoleGuard } from 'src/guard/role.guard';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) { }
  @Sse('payment-status')
  @Public()
  stream(@Query('orderId') orderId: string) {
    return this.paymentService.stream(orderId);
  }
  @Post('payos-webhook')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'PayOS Webhook' })
  async payosWebhook(@Body() body: Webhook) {
    try {
      console.log(body);
      await this.paymentService.payosWebhook(body);
      return { status: 'success', message: 'Webhook processed successfully' };
    } catch (error) {
      console.error('Error processing PayOS webhook:', error);
      // Always return 200 to acknowledge receipt to PayOS
      return { status: 'error', message: 'Webhook processed with error' };
    }
  }

  @Get('all')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all payments with pagination' })
  @ApiOkResponse({ type: PaginatedGetPaymentResponseDto })
  async getAllPayments(@Query() query: GetPaymentQueryDto) {
    try {
      return await this.paymentService.getAllPayments(query);
    } catch (error) {
      console.error('Error fetching all payments:', error);
      throw new HttpException(error.message, error.status);
    }
  }

  @Get('payment-details/:orderId')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get payment logs for an order' })
  @ApiOkResponse({ type: [GetPaymentLogsResponseDto] })
  async getPaymentLogs(@Param('orderId') orderId: string) {
    try {
      const payments = await this.paymentService.getPaymentLogs(orderId);
      return payments;
    } catch (error) {
      console.error('Error fetching payment logs:', error);
      throw new HttpException(error.message, error.status);
    }
  }
}

