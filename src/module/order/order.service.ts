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
  discount_events,
  discount_event_products,
} from 'src/database/schema';
import { eq, inArray, and, sql, SQL, lte, gte, or, isNull } from 'drizzle-orm';
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
  ) { }
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

      const now = new Date();
      data.forEach((variant) => {
        let finalPrice = variant.price;
        // Check if cached salePrice is active based on validity dates
        if (
          variant.salePrice !== null &&
          variant.validFrom &&
          variant.validFrom <= now &&
          (!variant.validTo || variant.validTo >= now)
        ) {
          finalPrice = variant.salePrice;
        }
        priceMap.set(variant.id, finalPrice);
      });

      // Self-healing fallback: find any products whose variants are missing active sale info but might be on sale
      const staleProductIds = Array.from(
        new Set(
          data
            .filter((v) => {
              const isSalePriceMissing = v.salePrice === null;
              const isSalePriceExpired = v.validTo && v.validTo < now;
              const isSalePriceNotStarted = v.validFrom && v.validFrom > now;
              return (
                isSalePriceMissing ||
                isSalePriceExpired ||
                isSalePriceNotStarted
              );
            })
            .map((v) => v.productId),
        ),
      );

      if (staleProductIds.length > 0) {
        const foundPromotions = await tx
          .select({
            productId: discount_event_products.productId,
            discountPercentage: discount_event_products.discountPercentage,
            startDate: discount_events.startDate,
            endDate: discount_events.endDate,
            eventId: discount_events.id,
          })
          .from(discount_event_products)
          .innerJoin(
            discount_events,
            and(
              eq(discount_event_products.eventId, discount_events.id),
              eq(discount_events.isActive, true),
              lte(discount_events.startDate, now),
              or(
                isNull(discount_events.endDate),
                gte(discount_events.endDate, now),
              ),
            ),
          )
          .where(inArray(discount_event_products.productId, staleProductIds));

        for (const promo of foundPromotions) {
          const variantsOfProduct = data.filter(
            (v) => v.productId === promo.productId,
          );
          for (const v of variantsOfProduct) {
            const finalPrice = Math.floor(
              v.price - (v.price * promo.discountPercentage) / 100.0,
            );
            priceMap.set(v.id, finalPrice);

            await tx
              .update(product_variants)
              .set({
                salePrice: finalPrice,
                discountPercentage: promo.discountPercentage,
                discountEventId: promo.eventId,
                validFrom: promo.startDate,
                validTo: promo.endDate,
              })
              .where(eq(product_variants.id, v.id));
          }
        }
      }

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

      // DECREASE STOCK
      for (const item of items) {
        await tx
          .update(product_variants)
          .set({ stock: sql`${product_variants.stock} - ${item.quantity}` })
          .where(eq(product_variants.id, item.variantId));

        // ALSO DECREASE SALE EVENT STOCK
        const variant = data.find((v) => v.id === item.variantId);
        if (variant?.discountEventId) {
          await tx
            .update(discount_event_products)
            .set({ stock: sql`${discount_event_products.stock} - ${item.quantity}` })
            .where(
              and(
                eq(discount_event_products.eventId, variant.discountEventId),
                eq(discount_event_products.productId, variant.productId)
              )
            );
        }
      }
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
          price: priceMap.get(item.variantId) || 0,
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
      const paymentResult = await tx
        .insert(payments)
        .values({
          orderId: order[0].id,
          paymentMethodId: paymentMethod.id,
          amount: total,
          status: 'pending',
          transactionId: transactionId,
        })
        .returning();

      await tx.insert(payment_transaction_logs).values({
        status: 'pending',
        action: 'create',
        paymentId: paymentResult[0].id,
        payload:
          paymentMethod.code === 'payos'
            ? { checkoutUrl: paylink, transactionId }
            : null,
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
        with: {
          items: true,
        },
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

      if (data.status === 'cancelled') {
        for (const item of order.items) {
          await tx
            .update(product_variants)
            .set({ stock: sql`${product_variants.stock} + ${item.quantity}` })
            .where(eq(product_variants.id, item.variantId));
        }
      }

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
        payments: true,
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
    return await this.db.transaction(async (tx) => {
      const order = await tx.query.customer_orders.findFirst({
        where: eq(customer_orders.orderCode, orderCode),
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const payment = await tx.query.payments.findFirst({
        where: eq(payments.orderId, order.id),
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // 1. Log the transaction event
      await tx.insert(payment_transaction_logs).values({
        status: status,
        action: 'webhook_update',
        paymentId: payment.id,
        payload: data,
      });

      // 2. Update payment status and transaction ID
      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: status as any,
        })
        .where(eq(payments.id, payment.id))
        .returning();

      // 3. If successful, update the order status using standard updateOrder logic
      if (status === 'success' && order.status === 'pending') {
        const orderUpdated = await tx
          .update(customer_orders)
          .set({ status: 'processing' })
          .where(eq(customer_orders.id, order.id))
          .returning();

        await this.addLog(
          {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: 'processing',
            note: 'Thanh toán thành công qua PayOS',
          },
          tx,
        );

        this.orderEvents$.next({
          data: {
            event: 'order_updated',
            order: orderUpdated[0],
          },
        });
      } else if (status === 'cancelled' && order.status !== 'cancelled') {
        const orderUpdated = await tx
          .update(customer_orders)
          .set({ status: 'cancelled' })
          .where(eq(customer_orders.id, order.id))
          .returning();

        await this.addLog(
          {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: 'cancelled',
            note: 'Thanh toán bị huỷ qua PayOS',
          },
          tx,
        );

        // Fetch items to restore stock
        const itemsToRestore = await tx.query.customer_orders_items.findMany({
          where: eq(customer_orders_items.orderId, order.id),
        });

        for (const item of itemsToRestore) {
          await tx
            .update(product_variants)
            .set({ stock: sql`${product_variants.stock} + ${item.quantity}` })
            .where(eq(product_variants.id, item.variantId));
        }

        this.orderEvents$.next({
          data: {
            event: 'order_updated',
            order: orderUpdated[0],
          },
        });
      }

      return updatedPayment;
    });
  }

}
