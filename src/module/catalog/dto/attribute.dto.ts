import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { createZodDto } from "nestjs-zod";
import { attribute_groups, attribute_options, attributes } from "src/database/schema";
import { z } from "zod";

const createAttributeGroup = createInsertSchema(attribute_groups, {
    name: z.string().min(1, "Name is required"),
}).omit({
    id: true,
    categoryId: true,
});
export class CreateAttributeGroupDto extends createZodDto(createAttributeGroup) { }

const updateAttributeGroup = createUpdateSchema(attribute_groups, {
    name: z.string().min(1, "Name is required"),
}).omit({
    id: true,
    categoryId: true,
});
export class UpdateAttributeGroupDto extends createZodDto(updateAttributeGroup) { }

const createAttribute = createInsertSchema(attributes, {
    name: z.string().min(1, "Name is required"),
    type: z.string().min(1, "Type is required"),
    filterable: z.boolean().default(false),
    unit: z.string().optional(),
    sortOrder: z.number().optional(),
}).omit({
    id: true,
    groupId: true,
    slug: true,
});
export class CreateAttributeDto extends createZodDto(createAttribute) { }

const updateAttribute = createUpdateSchema(attributes, {
    name: z.string().min(1, "Name is required").optional(),
    type: z.string().optional(),
    filterable: z.boolean().optional(),
    unit: z.string().optional(),
    sortOrder: z.number().optional(),
}).omit({
    id: true,
    groupId: true,
    slug: true,
});
export class UpdateAttributeDto extends createZodDto(updateAttribute) { }

const createAttributeOption = createInsertSchema(attribute_options, {
    value: z.string().min(1, "Value is required"),
}).omit({
    id: true,
    attributeId: true,
    slug: true,
});
export class CreateAttributeOptionDto extends createZodDto(createAttributeOption) { }

const updateAttributeOption = createUpdateSchema(attribute_options, {
    value: z.string().min(1, "Value is required").optional(),
}).omit({
    id: true,
    attributeId: true,
    slug: true,
});
export class UpdateAttributeOptionDto extends createZodDto(updateAttributeOption) { }
