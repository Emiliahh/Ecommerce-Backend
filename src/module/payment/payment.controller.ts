import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { type Webhook } from '@payos/node';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('payos-webhook')
  @ApiOperation({ summary: 'PayOS Webhook' })
  async payosWebhook(@Body() body: Webhook) {
    try {
      await this.paymentService.payosWebhook(body);
      return { status: 'success', message: 'Webhook processed successfully' };
    } catch (error) {
      console.error('Error processing PayOS webhook:', error);
    }
  }
}
