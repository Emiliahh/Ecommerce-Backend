import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ── Add product to event ──────────────────────────────────────────
const addProductToEventSchema = z.object({
  productId: z.string().uuid(),
  discountPercentage: z.number().int().min(0).max(100).default(0),
  stock: z.number().int().min(0).default(0),
});
export class AddProductToEventDto extends createZodDto(
  addProductToEventSchema,
) {}

// ── Update event product config ───────────────────────────────────
const updateEventProductSchema = z.object({
  discountPercentage: z.number().int().min(0).max(100).optional(),
  stock: z.number().int().min(0).optional(),
});
export class UpdateEventProductDto extends createZodDto(
  updateEventProductSchema,
) {}

// ── Response ─────────────────────────────────────────────────────
const getEventProductResponseSchema = z.object({
  eventId: z.string().uuid(),
  productId: z.string().uuid(),
  discountPercentage: z.number(),
  stock: z.number(),
  product: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    })
    .optional(),
});
export class GetEventProductResponseDto extends createZodDto(
  getEventProductResponseSchema,
) {}
