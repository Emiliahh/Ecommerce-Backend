import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { CreatePaymentLinkRequest, PayOS, Webhook } from '@payos/node';
import { PAYOS_INSTANCE } from './payos.provider/payos.provider';
import { OrderService } from '../order/order.service';
import { Subject, filter } from 'rxjs';
import { type DB, DRIZZLE } from 'src/database/dizzle.provider';
import { payments } from 'src/database/schema';
import { eq, count, desc, and } from 'drizzle-orm';
import { GetPaymentQueryDto } from './dto/get-payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(PAYOS_INSTANCE) private readonly payos: PayOS,
    // inject db
    @Inject(DRIZZLE) private readonly db: DB,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) { }
  orderEvents$ = new Subject<{ data: any }>();

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
      cancelUrl: 'http://localhost:3001/payment',
      returnUrl: 'http://localhost:3001/payment',
    };
    const paymentLink = await this.payos.paymentRequests.create(paymentData);
    return paymentLink;
  }
  async payosWebhook(data: Webhook) {
    try {
      const verifiedData = await this.payos.webhooks.verify(data);
      const orderCode = verifiedData.description; // Internal secure code

      if (verifiedData.code === '00') {
        await this.orderService.updatePaymentCode(
          orderCode,
          verifiedData,
          'success',
        );
        this.orderEvents$.next({
          data: { orderId: orderCode, status: 'success' },
        });
      } else {
        // Handle failure/cancellation
        await this.orderService.updatePaymentCode(
          orderCode,
          verifiedData,
          'failed', // Default to failed if code is not 00
        );
        this.orderEvents$.next({
          data: {
            orderId: orderCode,
            status: 'failed',
            code: verifiedData.code,
          },
        });
      }
    } catch (error) {
      console.error('Error processing PayOS webhook:', error);
    }
  }

  async getPaymentLogs(orderId: string) {
    const res = await this.db.query.payments.findMany({
      where: eq(payments.orderId, orderId),
      with: {
        transactionLogs: true,
      },
    });
    return res;
  }

  async getAllPayments(query: GetPaymentQueryDto) {
    const { limit, offset, status } = query;

    const whereClause = status ? eq(payments.status, status as any) : undefined;

    const [totalCountResult, data] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(payments)
        .where(whereClause),
      this.db.query.payments.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: [desc(payments.createdAt)],
        with: {
          order: {
            columns: {
              orderCode: true,
            },
          },
          transactionLogs: true,
        },
      }),
    ]);

    return {
      count: totalCountResult[0]?.value ?? 0,
      data,
    };
  }

  stream(orderId: string) {
    return this.orderEvents$.pipe(
      filter((event) => event.data.orderId === orderId),
    );
  }
}

