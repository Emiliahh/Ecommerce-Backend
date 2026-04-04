import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { CreatePaymentLinkRequest, PayOS, Webhook } from '@payos/node';
import { PAYOS_INSTANCE } from './payos.provider/payos.provider';
import { OrderService } from '../order/order.service';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(PAYOS_INSTANCE) private readonly payos: PayOS,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  async createPaymentLink(
    orderId: number,
    orderCode: string,
    amount: number,
    items: CreatePaymentLinkRequest['items'],
  ) {
    const paymentData: CreatePaymentLinkRequest = {
      orderCode: orderId,
      description: orderCode,
      amount: amount,
      items: items,
      cancelUrl: 'http://localhost:3000/cancel',
      returnUrl: 'http://localhost:3000/success',
    };
    const paymentLink = await this.payos.paymentRequests.create(paymentData);
    return paymentLink;
  }
  async payosWebhook(data: Webhook) {
    try {
      const verifiedData = await this.payos.webhooks.verify(data);

      if (verifiedData.code === '00') {
        const orderCode = verifiedData.description;
        await this.orderService.updatePaymentCode(
          orderCode,
          verifiedData,
          'success',
        );
      }
    } catch (error) {
      console.error('Error processing PayOS webhook:', error);
    }
  }
}
