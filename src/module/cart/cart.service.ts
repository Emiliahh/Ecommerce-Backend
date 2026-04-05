import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DB } from 'src/database/dizzle.provider';
import { and, eq, gte, lte, or, isNull, sql, exists } from 'drizzle-orm';
import {
  customer_carts,
  discount_event_products,
  discount_events,
  variant_images,
} from 'src/database/schema';
import { AddCartDto } from './dto/add-cart';
import { GetCartResponseDto } from './dto/get-cart.dto';

@Injectable()
export class CartService {
  constructor(@Inject(DRIZZLE) private readonly db: DB) { }

  async getUserCart(userId: string): Promise<GetCartResponseDto[]> {
    const now = new Date();
    const cart = await this.db.query.customer_carts.findMany({
      where: eq(customer_carts.userId, userId),
      with: {
        variant: {
          with: {
            product: {
              columns: {
                description: false,
                createdAt: false,
                updatedAt: false,
                seoMetadata: false,
              },
              with: {
                discountEvents: {
                  columns: {
                    discountPercentage: true,
                    stock: true,
                  },
                  with: {
                    event: true,
                  },
                },
              },
            },
            variantImages: {
              with: {
                image: true,
              },
              where: eq(variant_images.isMain, true),
            },
          },
        },
      },
    });
    // filter js side
    //@ts-ignore
    return cart.map((e) => {
      const discountEvent = e.variant.product.discountEvents.find((event) => {
        const eventStartDate = new Date(event.event.startDate);
        //9999-12-31
        const eventEndDate = new Date(event.event?.endDate || '9999-12-31');
        return (
          event.event.isActive &&
          now >= eventStartDate &&
          now <= eventEndDate &&
          event.stock > 0
        );
      });
      return {
        ...e,
        variant: {
          ...e.variant,
          product: {
            ...e.variant.product,
            discountEvent: discountEvent,
          },
        },
      };
    });
  }
  async updateCart(userId: string, dto: AddCartDto) {
    const cart = await this.db.query.customer_carts.findFirst({
      where: and(
        eq(customer_carts.userId, userId),
        eq(customer_carts.variantId, dto.variantId),
      ),
    });

    if (cart) {
      const newQuantity =
        dto.mode === 'replace'
          ? dto.quantity
          : sql`${customer_carts.quantity} + ${dto.quantity}`;

      await this.db
        .update(customer_carts)
        .set({ quantity: newQuantity })
        .where(eq(customer_carts.id, cart.id));
    } else {
      await this.db.insert(customer_carts).values({
        userId,
        variantId: dto.variantId,
        quantity: dto.quantity,
      });
    }

    return this.getUserCart(userId);
  }
  async removeCart(userId: string, variantId: string) {
    const cart = await this.db.query.customer_carts.findFirst({
      where: and(
        eq(customer_carts.userId, userId),
        eq(customer_carts.variantId, variantId),
      ),
    });
    if (cart) {
      await this.db
        .delete(customer_carts)
        .where(eq(customer_carts.id, cart.id));
    }
    return this.getUserCart(userId);
  }
}
