import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { type DB, DRIZZLE } from 'src/database/dizzle.provider';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  customer_orders,
  customer_orders_items,
  order_logs,
  payment_methods,
  payment_transaction_logs,
  payments,
  product_variants,
  variant_images,
} from 'src/database/schema';
import { eq, inArray, and, sql, SQL } from 'drizzle-orm';
import { GetOrderQueryDto } from './dto/get-order.dto';
import { CreateOrderLogDto } from './dto/create-order-log.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Subject } from 'rxjs';
import { PaymentService } from '../payment/payment.service';
import { WebhookData } from '@payos/node';
const acceptedPaymentMethod = ['payos', 'cod'];
@Injectable()
export class OrderService {
  public readonly orderEvents$ = new Subject<{ data: any }>();

  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
  ) {}
  async checkMethodExist(code: string) {
    if (!acceptedPaymentMethod.includes(code)) {
      throw new BadRequestException('Payment method not found');
    }
    const method = await this.db.query.payment_methods.findFirst({
      where: eq(payment_methods.code, code),
    });
    if (!method) {
      await this.db.insert(payment_methods).values({
        code: code,
        name: code,
        isActive: true,
        config: {},
      });
    }
  }
  async createOrder(userID: string, dto: CreateOrderDto) {
    await this.checkMethodExist(dto.paymentMethodCode);
    return await this.db.transaction(async (tx) => {
      const { items, paymentMethodCode, ...orderData } = dto;

      const priceMap = new Map<string, number>();
      const variantIds = items.map((item) => item.variantId);

      const data = await tx.query.product_variants.findMany({
        where: inArray(product_variants.id, variantIds),
      });
      data.forEach((variant) => {
        priceMap.set(variant.id, variant.price);
      });

      const total = items.reduce((sum, item) => {
        const price = priceMap.get(item.variantId) || 0;
        return sum + price * item.quantity;
      }, 0);

      const orderCode = this.generateSecureCode();
      const order = await tx
        .insert(customer_orders)
        .values({
          userId: userID,
          total,
          orderCode,
          ...orderData,
        })
        .returning();
      await tx.insert(customer_orders_items).values(
        items.map((item) => ({
          orderId: order[0].id,
          variantId: item.variantId,
          quantity: item.quantity,
          price: priceMap.get(item.variantId) || 0,
        })),
      );
      await this.addLog(
        {
          orderId: order[0].id,
          note: `Tạo đơn hàng`,
          toStatus: 'pending',
        },
        tx,
      );
      const paymentMethod = await this.getPaymentMethod(dto.paymentMethodCode);
      if (!paymentMethod) {
        throw new BadRequestException('Payment method not found');
      }
      let paylink = '';
      const item = items.map((item) => {
        const variant = data.find((v) => v.id === item.variantId);
        return {
          name: variant?.name || '',
          quantity: item.quantity || 0,
          price: variant?.price || 0,
        };
      });
      let transactionId = orderCode;
      if (paymentMethod.code === 'payos') {
        // number
        const intcode = Math.floor(Math.random() * 1000000) + 1;
        const res = await this.paymentService.createPaymentLink(
          intcode,
          orderCode,
          total,
          item,
        );
        paylink = res.checkoutUrl;
        transactionId = intcode.toString();
      }
      await tx.insert(payments).values({
        orderId: order[0].id,
        paymentMethodId: paymentMethod.id,
        amount: total,
        status: 'pending',
        transactionId: transactionId,
      });

      this.orderEvents$.next({
        data: {
          event: `order_created`,
          order: order[0],
        },
      });

      return {
        order: order[0],
        paylink,
      };
    });
  }
  async getPaymentMethod(code: string) {
    return await this.db.query.payment_methods.findFirst({
      where: eq(payment_methods.code, code),
    });
  }
  async updateOrder(orderId: string, data: UpdateOrderDto) {
    return await this.db.transaction(async (tx) => {
      const order = await tx.query.customer_orders.findFirst({
        where: eq(customer_orders.id, orderId),
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (!data.status) {
        if (data.note) {
          await this.addLog(
            {
              orderId,
              note: data.note,
              toStatus: order.status,
              fromStatus: order.status,
            },
            tx,
          );
        }
        return order;
      }

      // VALIDATE STATUS CHANGE
      const validTransitions: Record<string, string[]> = {
        pending: ['processing', 'cancelled'],
        processing: ['shipped', 'cancelled'],
        shipped: ['delivered', 'cancelled'],
        delivered: ['returned'],
        cancelled: [],
      };

      const validNextStatuses = validTransitions[order.status] || [];
      if (!validNextStatuses.includes(data.status)) {
        throw new BadRequestException(
          `Trạng thái '${data.status}' không hợp lệ khi đơn hàng đang ở trạng thái '${order.status}'`,
        );
      }
      const updatedOrder = await tx
        .update(customer_orders)
        .set({ status: data.status })
        .where(eq(customer_orders.id, orderId))
        .returning();

      await this.addLog(
        {
          orderId,
          fromStatus: order.status,
          toStatus: data.status,
          note:
            data.note ||
            `Trạng thái thay đổi từ '${order.status}' sang '${data.status}'`,
        },
        tx,
      );

      this.orderEvents$.next({
        data: {
          event: `order_updated`,
          order: updatedOrder[0],
        },
      });

      return updatedOrder[0];
    });
  }

  async addLog(
    logs: CreateOrderLogDto,
    txInstance?: Parameters<Parameters<DB['transaction']>[0]>[0],
  ) {
    const queryExecutor = txInstance || this.db;
    return await queryExecutor.insert(order_logs).values(logs).returning();
  }

  async getAllOrder(userId: string | undefined, query: GetOrderQueryDto) {
    const { limit, offset, status } = query;
    const conditions: SQL[] = [];

    if (userId) {
      conditions.push(eq(customer_orders.userId, userId));
    }

    if (status) {
      conditions.push(eq(customer_orders.status, status));
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    const data = await this.db.query.customer_orders.findMany({
      where: whereCondition,
      limit,
      offset,
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      with: {
        items: {
          with: {
            variant: {
              with: {
                product: {
                  columns: {
                    description: false,
                    seoMetadata: false,
                  },
                },
                variantImages: {
                  with: {
                    image: {
                      columns: {
                        url: true,
                      },
                    },
                  },
                  where: eq(variant_images.isMain, true),
                },
              },
            },
          },
        },
      },
    });

    const countRes = await this.db
      .select({ count: sql`count(*)` })
      .from(customer_orders)
      .where(whereCondition);

    const count = Number(countRes[0].count);

    return {
      count,
      data,
    };
  }

  async getOrderById(orderId: string, userId?: string) {
    const conditions: SQL[] = [eq(customer_orders.id, orderId)];
    if (userId) {
      conditions.push(eq(customer_orders.userId, userId));
    }

    const order = await this.db.query.customer_orders.findFirst({
      where: and(...conditions),
      with: {
        items: {
          with: {
            variant: {
              with: {
                product: {
                  columns: {
                    description: false,
                    seoMetadata: false,
                  },
                },
                variantImages: {
                  with: {
                    image: {
                      columns: {
                        url: true,
                      },
                    },
                  },
                  where: eq(variant_images.isMain, true),
                },
              },
            },
          },
        },
        logs: {
          orderBy: (logs, { desc }) => [desc(logs.createdAt)],
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
  // for payment
  generateSecureCode(length = 9) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    return Array.from(array)
      .map((x) => chars[x % chars.length])
      .join('');
  }
  async updatePaymentCode(
    orderCode: string,
    data: WebhookData,
    status: string,
  ) {
    const order = await this.db.query.customer_orders.findFirst({
      where: eq(customer_orders.orderCode, orderCode),
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const payment = await this.db.query.payments.findFirst({
      where: eq(payments.orderId, order.id),
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    await this.db.insert(payment_transaction_logs).values({
      status: status,
      action: status,
      paymentId: payment.id,
      payload: data,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const updatedPayment = await this.db
      .update(payments)
      .set({
        transactionId: orderCode,
      })
      .where(eq(payments.id, payment.id))
      .returning();
    return updatedPayment[0];
  }
}
