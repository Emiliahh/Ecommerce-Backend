import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { discount_events } from 'src/database/schema';
import { paginateSchema } from 'src/common/dto/paginate.dto';

/** Converts Date objects to ISO strings for JSON Schema compatibility */
const dateStr = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string(),
);

// ── Base ─────────────────────────────────────────────────────────
export const selectDiscountEventSchema = createSelectSchema(discount_events)
  .omit({
    startDate: true,
    endDate: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    startDate: dateStr,
    endDate: dateStr.nullable(),
    createdAt: dateStr,
    updatedAt: dateStr,
  });

// ── Create ───────────────────────────────────────────────────────
const createDiscountEventSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  startDate: z.string().min(1, 'startDate required'),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export class CreateDiscountEventDto extends createZodDto(
  createDiscountEventSchema,
) { }

// ── Update ───────────────────────────────────────────────────────
const updateDiscountEventSchema = createDiscountEventSchema.partial();
export class UpdateDiscountEventDto extends createZodDto(
  updateDiscountEventSchema,
) { }

// ── Query ────────────────────────────────────────────────────────
const getDiscountEventQuerySchema = paginateSchema.extend({
  status: z.enum(['live', 'upcoming', 'ended']).optional(),
  groupId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});
export class GetDiscountEventQueryDto extends createZodDto(
  getDiscountEventQuerySchema,
) { }

// ── Response ─────────────────────────────────────────────────────
const getDiscountEventResponseSchema = selectDiscountEventSchema.extend({
  status: z.enum(['live', 'upcoming', 'ended']),
  groupName: z.string().nullable().optional(),
  productsCount: z.number(),
  avgDiscount: z.number(),
  stockTotal: z.number(),
  stockUsed: z.number(),
});
export class GetDiscountEventResponseDto extends createZodDto(
  getDiscountEventResponseSchema,
) { }

const paginatedDiscountEventResponseSchema = z.object({
  count: z.number(),
  data: z.array(getDiscountEventResponseSchema),
});
export class PaginatedDiscountEventResponseDto extends createZodDto(
  paginatedDiscountEventResponseSchema,
) { }
