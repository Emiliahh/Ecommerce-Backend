import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  products,
  product_variants,
  product_images,
  variant_images,
  categories,
  discount_events,
  discount_event_products,
} from 'src/database/schema';
import { IPaginatedRes } from 'src/types/IPaginatedRes';
/** Converts Date objects to ISO strings for JSON Schema compatibility */
const dateStr = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string(),
);

// 1. Automatically generate base schemas for reading
export const selectProductSchema = createSelectSchema(products).omit({
  createdAt: true,
  updatedAt: true,
});
export const selectVariantSchema = createSelectSchema(product_variants);
const selectImageSchema = createSelectSchema(product_images);

const selectCategorySchema = createSelectSchema(categories).omit({
  createdAt: true,
  image: true,
  isDeleted: true,
  parentId: true,
  updatedAt: true,
  level: true,
});
const selectVariantImageSchema = createSelectSchema(variant_images);
const selectDiscountEventSchema = createSelectSchema(discount_events)
  .omit({
    startDate: true,
    endDate: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    startDate: dateStr,
    endDate: dateStr.nullable(),
    createdAt: dateStr,
    updatedAt: dateStr,
  });
const selectDiscountEventProductSchema = createSelectSchema(
  discount_event_products,
)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: dateStr,
    updatedAt: dateStr,
  });

const AttributeGroupSchema = z.object({
  groupName: z.string(),
  attributes: z.array(
    z.object({
      name: z.string().optional(),
      id: z.string().uuid().optional(),
      optionId: z.string().uuid().nullable().optional(),
      values: z.array(z.string()),
      filterable: z.boolean().optional(),
      sortOrder: z.number().optional(),
      unit: z.string().optional(),
    }),
  ),
});

const GetProductResponseSchema = selectProductSchema.extend({
  categoryPath: z.array(selectCategorySchema),
  images: z.array(selectImageSchema),
  attributeGroups: z.array(AttributeGroupSchema),
  variant_option: z.array(
    z.object({
      label: z.string(),
      value: z.string().uuid(),
      order: z.number().optional(),
      options: z.array(
        z.object({
          label: z.string(),
          value: z.string().uuid(),
        }),
      ),
    }),
  ),
  variants: z.array(
    selectVariantSchema.extend({
      variantImages: z.array(
        selectVariantImageSchema.extend({
          image: selectImageSchema.pick({ id: true, url: true }),
        }),
      ),
      attributes: z.array(
        z.object({
          attributeId: z.string().uuid(),
          optionId: z.string().uuid().nullable(),
          value: z.string(),
        }),
      ),
      finalPrice: z.number().optional(),
      basePrice: z.number().optional(),
      discountPercentage: z.number().nullable().optional(),
      promoStockLeft: z.number().nullable().optional(),
    }),
  ),
});

export default class GetProductResponseDto extends createZodDto(
  GetProductResponseSchema,
) {}

const PaginatedGetProductResponseSchema: z.ZodType<
  IPaginatedRes<GetProductResponseDto>
> = z.object({
  count: z.number(),
  data: z.array(GetProductResponseSchema),
});

export class PaginatedGetProductResponseDto extends createZodDto(
  PaginatedGetProductResponseSchema,
) {}

const GetProductListResponseSchema = selectProductSchema
  .omit({ description: true })
  .extend({
    images: z.array(selectImageSchema.pick({ url: true, isMain: true })),
    variants: z.array(selectVariantSchema.pick({ price: true, sku: true })),
    categorySlug: z.string(),
    discountEvents: z.array(
      selectDiscountEventProductSchema.extend({
        event: selectDiscountEventSchema.nullable(),
      }),
    ),
  });

export class GetProductListResponseDto extends createZodDto(
  GetProductListResponseSchema,
) {}

const PaginatedGetProductListResponseSchema = z.object({
  count: z.number(),
  data: z.array(GetProductListResponseSchema),
});

export class PaginatedGetProductListResponseDto extends createZodDto(
  PaginatedGetProductListResponseSchema,
) {}

const productQuerySchema = z.object({
  category: z.string().optional(),
  offset: z.number().optional().default(0),
  limit: z.number().max(100).min(0).default(10).optional(),
  sort_method: z.string().optional(),
  q: z.string().optional(),
  filter: z
    .record(z.string(), z.array(z.union([z.string(), z.number()])))
    .optional(),
});

export class ProductQueryDto extends createZodDto(productQuerySchema) {}
