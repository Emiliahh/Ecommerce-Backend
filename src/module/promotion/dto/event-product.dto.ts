import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { discount_event_products, products } from 'src/database/schema';

/** Converts Date objects to ISO strings for JSON Schema compatibility */
const dateStr = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string(),
);

// ── Base ─────────────────────────────────────────────────────────

export const selectProductSchema = createSelectSchema(products).extend({
  createdAt: dateStr.optional(),
  updatedAt: dateStr.optional(),
});

export const selectDiscountEventProductSchema = createSelectSchema(
  discount_event_products,
).extend({
  createdAt: dateStr.optional(),
  updatedAt: dateStr.optional(),
});

// ── Add product to event ──────────────────────────────────────────
const addProductToEventSchema = createInsertSchema(
  discount_event_products,
).pick({
  productId: true,
  discountPercentage: true,
  stock: true,
});
export class AddProductToEventDto extends createZodDto(
  addProductToEventSchema,
) {}

// ── Update event product config ───────────────────────────────────
const updateEventProductSchema = addProductToEventSchema.partial();
export class UpdateEventProductDto extends createZodDto(
  updateEventProductSchema,
) {}

// ── Response ─────────────────────────────────────────────────────
const getEventProductResponseSchema = selectProductSchema.extend({
  category: z.object({ slug: z.string() }).nullable().optional(),
  variants: z
    .array(z.object({ price: z.number(), sku: z.string() }))
    .optional(),
  images: z
    .array(
      z.object({ url: z.string(), isMain: z.boolean().nullable().optional() }),
    )
    .optional(),
  discountEvents: z.array(selectDiscountEventProductSchema).optional(),
});

export class GetEventProductResponseDto extends createZodDto(
  getEventProductResponseSchema,
) {}
