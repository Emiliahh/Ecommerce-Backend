import { createUpdateSchema, createInsertSchema } from 'drizzle-zod';
import {
  product_attribute_values,
  product_images,
  product_variants,
  products,
  variant_attribute_values,
} from 'src/database/schema';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { seoMetaData } from './create-product.dto';

export const updateProductImageSchema = createUpdateSchema(product_images).omit(
  {
    productId: true,
    id: true,
  },
);

export const updateVariantAttributeValueSchema = createUpdateSchema(
  variant_attribute_values,
  {
    attributeId: z.uuid({ message: 'ID thuộc tính không hợp lệ' }),
    optionId: z.preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z.uuid({ message: 'ID tùy chọn không hợp lệ' }).optional(),
    ),
    value: z.string().optional()
  },
).omit({
  variantId: true,
});

export const updateProductVariantSchema = createUpdateSchema(product_variants, {
  sku: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative').optional(),
  stock: z.number().min(0, 'Stock must be non-negative').optional(),
  name: z.string().optional(),
})
  .omit({
    productId: true,
  })
  .extend({
    images: z.array(z.url()).optional(),
    attributes: z.array(updateVariantAttributeValueSchema).optional(),
  });

export const updateAttributeSchema = createInsertSchema(
  product_attribute_values,
  {
    id: z.uuid().optional(),
    attributeId: z.uuid({ message: 'ID thuộc tính không hợp lệ' }),
    optionId: z.preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z.uuid({ message: 'ID tùy chọn không hợp lệ' }).optional(),
    ),
    value: z.string().optional(),
  },
).omit({
  productId: true,
  id: true,
});
const createImageSchema = createUpdateSchema(product_images, {
  url: z.string().url(),
  secureUrl: z.string().url().optional(),

  publicId: z.string().optional(),
  isMain: z.boolean().default(false),
  id: z.uuid().optional(),
}).omit({
  productId: true,
});
export const updateSchema = createUpdateSchema(products, {
  categoryId: z.uuid({ message: 'ID danh mục không hợp lệ' }).optional(),
  description: z.any().optional(),
  name: z.string().optional(),
  seoMetadata: seoMetaData.optional(),
})
  .omit({
    createdAt: true,
    updatedAt: true,
    slug: true,
  })
  .extend({
    variants: z.array(updateProductVariantSchema).optional(),
    images: z.array(createImageSchema).optional(),
    attribute: z.array(updateAttributeSchema).optional(),
  });

export class UpdateProductDto extends createZodDto(updateSchema) { }
