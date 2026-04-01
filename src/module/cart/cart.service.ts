import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DB } from 'src/database/dizzle.provider';
import { and, eq, sql } from 'drizzle-orm';
import { customer_carts, variant_images } from 'src/database/schema';
import { AddCartDto } from './dto/add-cart';
import { GetCartResponseDto } from './dto/get-cart.dto';

@Injectable()
export class CartService {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async getUserCart(userId: string): Promise<GetCartResponseDto[]> {
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
    return cart;
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
        quantity: dto.quantity, // Lần đầu tạo thì luôn là số từ dto
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
