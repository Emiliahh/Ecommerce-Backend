import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type DB, DRIZZLE } from 'src/database/dizzle.provider';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  customer_orders,
  customer_orders_items,
  order_logs,
  product_variants,
  variant_images,
} from 'src/database/schema';
import { eq, inArray, and, sql, SQL } from 'drizzle-orm';
import { GetOrderQueryDto } from './dto/get-order.dto';
import { CreateOrderLogDto } from './dto/create-order-log.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Subject } from 'rxjs';

@Injectable()
export class OrderService {
  public readonly orderEvents$ = new Subject<{ data: any }>();

  constructor(@Inject(DRIZZLE) private readonly db: DB) {}
  async createOrder(userID: string, dto: CreateOrderDto) {
    return await this.db.transaction(async (tx) => {
      const { items, ...orderData } = dto;

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
      const order = await tx
        .insert(customer_orders)
        .values({
          userId: userID,
          total,
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
      await this.addLog({
        orderId: order[0].id,
        note: `Tạo đơn hàng`,
        toStatus: 'pending',
      });

      this.orderEvents$.next({
        data: {
          event: `order_created`,
          order: order[0],
        },
      });

      return order[0];
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
        // If it's just a note update without status change
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

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

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
                product: true,
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
                product: true,
                variantImages: {
                  with: {
                    image: true,
                  },
                  where: eq(variant_images.isMain, true),
                },
              },
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
}
