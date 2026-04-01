import { createUpdateSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { categories } from 'src/database/schema';
import { z } from 'zod';

const updateCategory = createUpdateSchema(categories, {
  name: z.string().min(1, 'Name is required').optional(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/)
    .transform((value) => value.toLowerCase())
    .optional(),
  parentId: z.uuid().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
});
export default class UpdateCategoryDto extends createZodDto(updateCategory) {}
