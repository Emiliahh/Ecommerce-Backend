import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import {
  attribute_groups,
  attribute_options,
  attributes,
  categories,
} from 'src/database/schema';
import { z } from 'zod';

const attributeOptionSchema = createSelectSchema(attribute_options);
const groupSchema = createSelectSchema(attribute_groups);
const attributeSchema = createSelectSchema(attributes).extend({
  options: z.array(attributeOptionSchema),
  group: groupSchema,
});
const attributeGroupSchema = createSelectSchema(attribute_groups).extend({
  attributes: z.array(attributeSchema),
});

export class AttributeGroupResponseDto extends createZodDto(
  attributeGroupSchema,
) {}

const categoryWithAttributeGroupsSchema = createSelectSchema(categories)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    attributeGroups: z.array(attributeGroupSchema),
  });

export class CategoryWithAttributeGroupsDto extends createZodDto(
  categoryWithAttributeGroupsSchema,
) {}
