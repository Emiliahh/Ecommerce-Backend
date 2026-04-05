import { createInsertSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import {
  products,
  product_variants,
  product_attribute_values,
  product_images,
  variant_attribute_values,
} from 'src/database/schema';
import { z } from 'zod';
export const seoMetaData = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});
const createVariantAttributeValueSchema = createInsertSchema(
  variant_attribute_values,
  {
    attributeId: z.uuid({ message: 'ID thuộc tính không hợp lệ' }),
    optionId: z.preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z.uuid({ message: 'ID tùy chọn không hợp lệ' }).optional(),
    ),
  },
).omit({
  variantId: true,
});

// validator for create variant
const createVariantSchema = createInsertSchema(product_variants, {
  sku: z.string().min(1, 'SKU is required'),
  price: z.number().min(0, 'Price must be non-negative'),
  stock: z.number().min(0, 'Stock must be non-negative'),
  name: z.string().optional(),
})
  .omit({ productId: true, id: true, validFrom: true, validTo: true })
  .extend({
    images: z
      .preprocess(
        (val) => (Array.isArray(val) ? val.filter((v) => !!v) : val),
        z.array(z.string().url()),
      )
      .optional(),
    attributes: z.array(createVariantAttributeValueSchema).optional(),
  });
// validator for create atrribute .*eg memory = "256GB"
const createProductAttributeSchema = createInsertSchema(
  product_attribute_values,
  {
    attributeId: z.uuid({ message: 'ID thuộc tính không hợp lệ' }),
    optionId: z.preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z.uuid({ message: 'ID tùy chọn không hợp lệ' }).optional(),
    ),
    value: z.string().default(''),
  },
).omit({
  id: true,
  productId: true,
});
const createImageSchema = createInsertSchema(product_images, {
  url: z.string().url(),
  secureUrl: z.string().url().optional(),
  publicId: z.string().optional(),
  isMain: z.boolean().default(false),
}).omit({
  id: true,
  productId: true,
});
const createSchema = createInsertSchema(products, {
  categoryId: z.uuid({ message: 'ID danh mục không hợp lệ' }),
  description: z.any().optional(),
  name: z.string().min(1, 'Name is required'),
  seoMetadata: seoMetaData.optional(),
})
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    slug: true,
  })
  .extend({
    variants: z.array(createVariantSchema).min(1, 'At least one variant is required'),
    images: z.array(createImageSchema).optional(),
    attribute: z.array(createProductAttributeSchema).optional(),
  });

export class CreateProductDto extends createZodDto(createSchema) { }
