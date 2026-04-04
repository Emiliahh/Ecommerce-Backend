import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { promo_code } from 'src/database/schema';
import { paginateSchema } from 'src/common/dto/paginate.dto';

/** Converts Date objects to ISO strings for JSON Schema compatibility */
const dateStr = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string(),
);

// ── Base ─────────────────────────────────────────────────────────
export const selectPromoCodeSchema = createSelectSchema(promo_code)
  .omit({
    startDate: true,
    endDate: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    startDate: dateStr,
    endDate: dateStr,
    createdAt: dateStr,
    updatedAt: dateStr,
  });

// ── Create ───────────────────────────────────────────────────────
const createPromoCodeSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().int().min(1),
  description: z.string().optional().nullable(),
  limit: z.number().int().min(1),
  startDate: z.string().min(1, 'startDate required'),
  endDate: z.string().min(1, 'endDate required'),
  isActive: z.boolean().optional().default(true),
});

export class CreatePromoCodeDto extends createZodDto(createPromoCodeSchema) { }

// ── Update ───────────────────────────────────────────────────────
const updatePromoCodeSchema = createPromoCodeSchema.partial();
export class UpdatePromoCodeDto extends createZodDto(updatePromoCodeSchema) { }

// ── Query ────────────────────────────────────────────────────────
const getPromoCodeQuerySchema = paginateSchema.extend({
  discountType: z.enum(['percentage', 'fixed']).optional(),
  status: z.enum(['active', 'inactive', 'exhausted', 'expired']).optional(),
  search: z.string().optional(),
});
export class GetPromoCodeQueryDto extends createZodDto(
  getPromoCodeQuerySchema,
) { }

// ── Response ─────────────────────────────────────────────────────
const getPromoCodeResponseSchema = selectPromoCodeSchema.extend({
  status: z.enum(['active', 'inactive', 'exhausted', 'expired']),
});
export class GetPromoCodeResponseDto extends createZodDto(
  getPromoCodeResponseSchema,
) { }

const paginatedPromoCodeResponseSchema = z.object({
  count: z.number(),
  data: z.array(getPromoCodeResponseSchema),
});
export class PaginatedPromoCodeResponseDto extends createZodDto(
  paginatedPromoCodeResponseSchema,
) { }
