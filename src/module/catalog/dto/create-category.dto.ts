import { createInsertSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import {
  attribute_groups,
  attribute_options,
  attributes,
  categories,
} from 'src/database/schema';
import z from 'zod';

const createAttributeOption = createInsertSchema(attribute_options, {
  value: z.string().min(1, 'Value is required'),
}).omit({
  id: true,
  attributeId: true,
});

const createAttribute = createInsertSchema(attributes, {
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  filterable: z.boolean().default(false),
  unit: z.string().optional(),
  sortOrder: z.number().optional(),
  // slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/).transform((value) => value.toLowerCase()),
  // group id will be created from transaction
})
  .omit({
    id: true,
    groupId: true,
  })
  .extend({
    options: z.array(createAttributeOption).optional(),
  });

const createAttributeGroup = createInsertSchema(attribute_groups, {
  name: z.string().min(1, 'Name is required'),
  categoryId: z.uuid().optional(),
})
  .omit({
    id: true,
  })
  .extend({
    attributes: z.array(createAttribute).optional(),
  });
const createCategoryDto = createInsertSchema(categories, {
  name: z.string().min(1, 'Name is required'),
  parentId: z.uuid().optional(),
})
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    isDeleted: true,
    slug: true,
  })
  .extend({
    attribute_groups: z.array(createAttributeGroup).optional(),
  });

export class CreateCategoryDto extends createZodDto(createCategoryDto) {}
