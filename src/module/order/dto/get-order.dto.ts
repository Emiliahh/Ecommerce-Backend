import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  customer_orders,
  customer_orders_items,
  product_variants,
  products,
} from 'src/database/schema';
import { IPaginatedRes } from 'src/types/IPaginatedRes';
import { paginateSchema } from 'src/common/dto/paginate.dto';

// 1. Base schemas
export const selectOrderSchema = createSelectSchema(customer_orders);
export const selectOrderItemSchema = createSelectSchema(customer_orders_items);
export const selectVariantSchema = createSelectSchema(product_variants);
export const selectProductSchema = createSelectSchema(products);

// 2. Query schema (extends paginate schema)
const getOrderQuerySchema = paginateSchema.extend({
  status: z
    .enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
    .optional(),
  userId: z.string().uuid().optional(),
});

export class GetOrderQueryDto extends createZodDto(getOrderQuerySchema) {}

// 3. Response schemas
const getOrderResponseSchema = selectOrderSchema.extend({
  items: z
    .array(
      selectOrderItemSchema.extend({
        variant: selectVariantSchema
          .extend({
            product: selectProductSchema.optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export class GetOrderResponseDto extends createZodDto(getOrderResponseSchema) {}

// 4. Paginated response schema
const paginatedGetOrderResponseSchema: z.ZodType<
  IPaginatedRes<GetOrderResponseDto>
> = z.object({
  count: z.number(),
  data: z.array(getOrderResponseSchema),
});

export class PaginatedGetOrderResponseDto extends createZodDto(
  paginatedGetOrderResponseSchema,
) {}
