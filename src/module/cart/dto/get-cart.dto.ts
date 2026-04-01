import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  customer_carts,
  product_variants,
  products,
  product_images,
} from 'src/database/schema';

const selectCartSchema = createSelectSchema(customer_carts);
const selectVariantSchema = createSelectSchema(product_variants);
const selectProductSchema = createSelectSchema(products).omit({
  description: true,
  createdAt: true,
  updatedAt: true,
  seoMetadata: true,
});
const selectImageSchema = createSelectSchema(product_images);

export const GetCartResponseSchema = selectCartSchema
  .extend({
    createdAt: z.date().transform((date) => date.toISOString()),
    updatedAt: z.date().transform((date) => date.toISOString()),
    variant: selectVariantSchema.extend({
      product: selectProductSchema,
      variantImages: z.array(
        z.object({
          image: selectImageSchema,
        }),
      ),
    }),
  })
  .omit({ createdAt: true, updatedAt: true });

export class GetCartResponseDto extends createZodDto(GetCartResponseSchema) {}
