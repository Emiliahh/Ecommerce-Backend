import { createInsertSchema } from "drizzle-zod";
import { createZodDto } from "nestjs-zod";
import { import_orders, import_order_items } from "src/database/schema";
import z from "zod";

const createImportSchema = createInsertSchema(import_orders).omit({
    createdAt: true,
    id: true,
    updatedAt: true,
})
export const createImportItemSchema = createInsertSchema(import_order_items).omit({
    createdAt: true,
    id: true,
    updatedAt: true,
    importOrderId: true,
})
const createImportWithItemsSchema = createImportSchema.extend({
    items: z.array(createImportItemSchema).min(1, "You must include at least one item"),
});
export default class CreateImportDto extends createZodDto(createImportSchema) { }
export class CreateImportItemDto extends createZodDto(createImportItemSchema) { }
export class CreateImportWithItemsDto extends createZodDto(createImportWithItemsSchema) { }