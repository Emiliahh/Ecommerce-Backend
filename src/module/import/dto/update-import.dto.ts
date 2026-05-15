import { createUpdateSchema } from "drizzle-zod";
import { createZodDto } from "nestjs-zod";
import { import_order_items, import_orders } from "src/database/schema";
import z from "zod";
import { createImportItemSchema } from "./create-import.dto";

const updateImportSchema = createUpdateSchema(import_orders).omit({
    createdAt: true,
    id: true,
    updatedAt: true,
})
const updateImportItemSchema = createUpdateSchema(import_order_items).omit({
    createdAt: true,
    id: true,
    updatedAt: true,
    importOrderId: true,
})

const updateImportWithItemsSchema = updateImportSchema.extend({
    items: z.array(createImportItemSchema),
});
export class UpdateImportDto extends createZodDto(updateImportSchema) { }
export class UpdateImportItemDto extends createZodDto(updateImportItemSchema) { }
export class UpdateImportWithItemsDto extends createZodDto(updateImportWithItemsSchema) { }