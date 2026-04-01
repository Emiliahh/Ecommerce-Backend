import { createZodDto } from 'nestjs-zod';
import { booleanString } from 'src/common/dto/boolen-transform';
import PaginateDTO, { paginateSchema } from 'src/common/dto/paginate.dto';
import { z } from 'zod';



const getCategoryFilterSchema = z.object({
    q: z.string().optional(),
    sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    parentId: z.uuid().optional(),
    rootOnly: booleanString.optional().default(false).describe('only return root categories (those without a parent)'),
    includeAttributes: booleanString.optional().default(false).describe('include attribute groups with attributes and options'),
    maxDepth: z.coerce.number().optional().default(0).describe('maximum depth of categories to return'),
}).extend(paginateSchema.shape);

export class GetCategoryFilterDto extends createZodDto(getCategoryFilterSchema) { }

const filterOptionSchema = z.object({
    label: z.string(),
    value: z.string(),
});

const filterAttributeSchema = z.object({
    label: z.string(),
    value: z.string(),
    options: z.array(filterOptionSchema),
});

const categoryPathSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
});

const getCategoryFilterResponseSchema = z.object({
    path: z.array(categoryPathSchema),
    priceRange: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
    }),
    filters: z.array(filterAttributeSchema),
});

export class GetCategoryFilterResponseDto extends createZodDto(getCategoryFilterResponseSchema) { }
