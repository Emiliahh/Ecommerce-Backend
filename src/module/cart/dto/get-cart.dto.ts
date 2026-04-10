import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  customer_carts,
  product_variants,
  products,
  product_images,
  discount_events,
  discount_event_products,
} from 'src/database/schema';
import { selectVariantSchema } from 'src/module/product/dto/get-product.dto';
/** Converts Date objects to ISO strings for JSON Schema compatibility */
const dateStr = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string(),
);

const selectCartSchema = createSelectSchema(customer_carts);
// omit date

const selectProductSchema = createSelectSchema(products).omit({
  description: true,
  createdAt: true,
  updatedAt: true,
  seoMetadata: true,
});
const selectImageSchema = createSelectSchema(product_images);
const discountEventSchema = createSelectSchema(discount_event_products).omit({
  createdAt: true,
  updatedAt: true,
});

export const GetCartResponseSchema = selectCartSchema
  .extend({
    createdAt: z.date().transform((date) => date.toISOString()),
    updatedAt: z.date().transform((date) => date.toISOString()),
    variant: selectVariantSchema.extend({
      product: selectProductSchema.extend({
        discountEventSchema: z.array(discountEventSchema).optional(),
      }),
      variantImages: z.array(
        z.object({
          image: selectImageSchema,
        }),
      ),
    }),
  })
  .omit({ createdAt: true, updatedAt: true });

export class GetCartResponseDto extends createZodDto(GetCartResponseSchema) {}
