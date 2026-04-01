import { createSelectSchema } from 'drizzle-zod';
import {
  attribute_groups,
  attribute_options,
  attributes,
  categories,
} from 'src/database/schema';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { IPaginatedRes } from 'src/types/IPaginatedRes';

const categorySchema = createSelectSchema(categories).omit({
  createdAt: true,
  updatedAt: true,
});

export class GetCategoryResponseDto extends createZodDto(categorySchema) {}

const PaginatedGetCategoryResponseSchema: z.ZodType<
  IPaginatedRes<GetCategoryResponseDto>
> = z.object({
  count: z.number(),
  data: z.array(categorySchema),
});

export class PaginatedCategoryListResponseDto extends createZodDto(
  PaginatedGetCategoryResponseSchema,
) {}

// Nested schemas for detail view
const attributeOptionSchema = createSelectSchema(attribute_options);

const attributeSchema = createSelectSchema(attributes).extend({
  options: z.array(attributeOptionSchema),
});

const attributeGroupSchema = createSelectSchema(attribute_groups).extend({
  attributes: z.array(attributeSchema),
});

const categoryDetailSchema = categorySchema.extend({
  attributeGroups: z.array(attributeGroupSchema),
});

export class GetCategoryDetailResponseDto extends createZodDto(
  categoryDetailSchema,
) {}

const categoryTreeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string(),
    image: z.string().optional(),
    value: z.string(),
    level: z.number(),
    slug: z.string(),
    children: z.array(categoryTreeSchema),
  }),
);

export class CategoryTreeResponseDto extends createZodDto(categoryTreeSchema) {}
