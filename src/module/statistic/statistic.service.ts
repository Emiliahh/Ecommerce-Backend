import { Inject, Injectable } from '@nestjs/common';
import { type DB, DRIZZLE } from 'src/database/dizzle.provider';
import {
    customer_orders,
    customer_orders_items,
    product_images,
    product_variants,
    products,
} from 'src/database/schema';
import { and, count, gte, lte, sql, sum, eq, desc } from 'drizzle-orm';
import getBestSellerQuery from './dto/get-best-seller.dto';
import GetBestSellerQuery from './dto/get-best-seller.dto';

@Injectable()
export class StatisticService {
    constructor(@Inject(DRIZZLE) private readonly db: DB) { }

    async getStatistic(from: Date, to: Date) {
        const itemSoldSubquery = this.db
            .select({
                count: sum(customer_orders_items.quantity),
            })
            .from(customer_orders_items)
            .innerJoin(
                customer_orders,
                eq(customer_orders_items.orderId, customer_orders.id),
            )
            .where(
                and(
                    gte(customer_orders.createdAt, from),
                    lte(customer_orders.createdAt, to),
                ),
            );
        const [stats] = await this.db
            .select({
                totalOrder: count(customer_orders.id),
                totalRevenue: sum(
                    sql`case when ${customer_orders.status} = 'cancelled' then 0 else ${customer_orders.total} end`,
                ),
                cancel_order: count(
                    sql`Case when ${customer_orders.status} = 'cancelled' then 1 else null end`,
                ),
                pending_order: count(
                    sql`Case when ${customer_orders.status} = 'pending' then 1 else null end`,
                ),
                processing_order: count(
                    sql`Case when ${customer_orders.status} = 'processing' then 1 else null end`,
                ),
                shipped_order: count(
                    sql`Case when ${customer_orders.status} = 'shipped' then 1 else null end`,
                ),
                delivered_order: count(
                    sql`Case when ${customer_orders.status} = 'delivered' then 1 else null end`,
                ),
                item_sold: sql<number>`COALESCE((${itemSoldSubquery}), 0)`.mapWith(Number),
            })
            .from(customer_orders)
            .where(
                and(
                    gte(customer_orders.createdAt, from),
                    lte(customer_orders.createdAt, to),
                ),
            );

        const totalOrder = stats?.totalOrder || 0;
        const totalRevenue = Number(stats?.totalRevenue) || 0;
        const cancel_order = stats?.cancel_order || 0;
        const pending_order = stats?.pending_order || 0;
        const processing_order = stats?.processing_order || 0;
        const shipped_order = stats?.shipped_order || 0;
        const delivered_order = stats?.delivered_order || 0;
        const item_sold = stats?.item_sold || 0;

        const avg_per_order = totalOrder > 0 ? totalRevenue / totalOrder : 0;
        return {
            totalOrder,
            totalRevenue,
            avg_per_order,
            cancel_order,
            pending_order,
            processing_order,
            shipped_order,
            delivered_order,
            item_sold,
        };
    }
    async getRevenueStatitistic(type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
        const now = new Date();
        const frames: { label: string; from: Date; to: Date }[] = [];
        switch (type) {
            case 'daily':
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate() - i,
                    );
                    frames.push({
                        label: date.toLocaleDateString('vi-VN'),
                        from: date,
                        to: new Date(
                            date.getFullYear(),
                            date.getMonth(),
                            date.getDate() + 1,
                        ),
                    });
                }
                break;
            case 'weekly':
                // 4 week
                for (let i = 3; i >= 0; i--) {
                    const date = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate() - i * 7,
                    );
                    frames.push({
                        label: date.toLocaleDateString('vi-VN'),
                        from: date,
                        to: new Date(
                            date.getFullYear(),
                            date.getMonth(),
                            date.getDate() + 7,
                        ),
                    });
                }
                break;
            case 'monthly':
                for (let i = 11; i >= 0; i--) {
                    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    frames.push({
                        label: date.toLocaleDateString('vi-VN'),
                        from: date,
                        to: new Date(date.getFullYear(), date.getMonth() + 1, 0),
                    });
                }
                break;
        }
        const data = await Promise.all(
            frames.map(async (frame) => {
                const [stats] = await this.db
                    .select({
                        totalOrder: count(customer_orders.id),
                        totalRevenue: sum(customer_orders.total),
                    })
                    .from(customer_orders)
                    .where(
                        and(
                            gte(customer_orders.createdAt, frame.from),
                            lte(customer_orders.createdAt, frame.to),
                        ),
                    );
                return {
                    label: frame.label,
                    totalOrder: stats?.totalOrder || 0,
                    totalRevenue: Number(stats?.totalRevenue) || 0,
                };
            }),
        );
        return data;
    }
    async bestSeller(query: GetBestSellerQuery) {
        const { limit = 10, offset = 0, startDate, endDate } = query;
        const from = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = endDate || new Date();

        const mainImage = this.db
            .select({ url: product_images.url })
            .from(product_images)
            .where(
                and(
                    eq(product_images.productId, products.id),
                    eq(product_images.isMain, true)
                )
            )
            .limit(1);

        const [data, [{ total }]] = await Promise.all([
            this.db
                .select({
                    productId: products.id,
                    productName: products.name,
                    totalSold: sum(customer_orders_items.quantity),
                    totalRevenue: sql<number>`sum(${customer_orders_items.price} * ${customer_orders_items.quantity})`,
                    image: sql<string>`(${mainImage})`,
                })
                .from(customer_orders_items)
                .innerJoin(product_variants, eq(customer_orders_items.variantId, product_variants.id))
                .innerJoin(products, eq(product_variants.productId, products.id))
                .where(
                    and(
                        gte(customer_orders_items.createdAt, from),
                        lte(customer_orders_items.createdAt, to),
                    ),
                )
                .groupBy(products.id, products.name)
                .orderBy(desc(sum(customer_orders_items.quantity)))
                .offset(offset)
                .limit(limit),

            this.db
                .select({ total: sql<number>`count(distinct ${products.id})` })
                .from(customer_orders_items)
                .innerJoin(product_variants, eq(customer_orders_items.variantId, product_variants.id))
                .innerJoin(products, eq(product_variants.productId, products.id))
                .where(
                    and(
                        gte(customer_orders_items.createdAt, from),
                        lte(customer_orders_items.createdAt, to),
                    ),
                ),
        ]);

        return { count: Number(total), data };
    }
}
