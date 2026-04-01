import { createZodDto } from 'nestjs-zod';
import z from 'zod';

// limit and offset
export const paginateSchema = z.object({
  limit: z.coerce
    .number()
    .min(0)
    .optional()
    .default(10)
    .describe('limit how many items to return'),
  offset: z.coerce
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe('offset how many items to skip'),
});

export default class PaginateDTO extends createZodDto(paginateSchema) {}
