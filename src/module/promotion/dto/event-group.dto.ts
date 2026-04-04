import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { discount_events_groups } from 'src/database/schema';
import { paginateSchema } from 'src/common/dto/paginate.dto';

/** Converts Date objects to ISO strings for JSON Schema compatibility */
const dateStr = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString() : v),
  z.string(),
);
export const selectEventGroupSchema = createSelectSchema(discount_events_groups)
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

const createEventGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  order: z.number().int().optional().nullable(),
  bannerImage: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  startDate: z.string().min(1, 'startDate required'),
  endDate: z.string().min(1, 'endDate required'),
});

export class CreateEventGroupDto extends createZodDto(createEventGroupSchema) {}

const updateEventGroupSchema = createEventGroupSchema.partial();
export class UpdateEventGroupDto extends createZodDto(updateEventGroupSchema) {}

const getEventGroupQuerySchema = paginateSchema.extend({
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});
export class GetEventGroupQueryDto extends createZodDto(
  getEventGroupQuerySchema,
) {}

const getEventGroupResponseSchema = selectEventGroupSchema.extend({
  eventsCount: z.number().optional(),
});
export class GetEventGroupResponseDto extends createZodDto(
  getEventGroupResponseSchema,
) {}

const paginatedEventGroupResponseSchema = z.object({
  count: z.number(),
  data: z.array(getEventGroupResponseSchema),
});
export class PaginatedEventGroupResponseDto extends createZodDto(
  paginatedEventGroupResponseSchema,
) {}
