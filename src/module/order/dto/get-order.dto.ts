import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  customer_orders,
  customer_orders_items,
  product_variants,
  products,
  order_logs,
} from 'src/database/schema';
import { IPaginatedRes } from 'src/types/IPaginatedRes';
import { paginateSchema } from 'src/common/dto/paginate.dto';

const dateStringSchema = z.preprocess(
  (val) => (val instanceof Date ? val.toISOString() : val),
  z.string(),
);

// 1. Base schemas
export const selectOrderSchema = createSelectSchema(customer_orders)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: dateStringSchema,
    updatedAt: dateStringSchema,
  });
export const selectOrderItemSchema = createSelectSchema(
  customer_orders_items,
)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: dateStringSchema,
    updatedAt: dateStringSchema,
  });
export const selectVariantSchema = createSelectSchema(product_variants);
export const selectProductSchema = createSelectSchema(products)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: dateStringSchema,
    updatedAt: dateStringSchema,
  });

export const selectOrderLogSchema = createSelectSchema(order_logs)
  .omit({
    createdAt: true,
  })
  .extend({
    createdAt: dateStringSchema,
  });

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
            variantImages: z
              .array(
                z.object({
                  image: z.object({
                    url: z.string(),
                  }),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  logs: z.array(selectOrderLogSchema).optional(),
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
