import { createSelectSchema } from 'drizzle-zod';
import { payment_transaction_logs, payments } from 'src/database/schema';
import z from 'zod';
import { dateStr } from 'src/common/dto/date';
import { createZodDto } from 'nestjs-zod';
import { paginateSchema } from 'src/common/dto/paginate.dto';

export const transactionLogsSchema = createSelectSchema(payment_transaction_logs)
  .omit({
    createdAt: true,
  })
  .extend({
    createdAt: dateStr,
  });

export const paymentSchema = createSelectSchema(payments)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: dateStr,
    updatedAt: dateStr,
    transactionLogs: z.array(transactionLogsSchema).optional(),
    order: z.object({
      orderCode: z.string().nullable(),
    }).optional(),
  });

export class GetPaymentLogsResponseDto extends createZodDto(paymentSchema) { }

// Pagination DTOs
export const getPaymentQuerySchema = paginateSchema.extend({
  status: z.string().optional(),
});
export class GetPaymentQueryDto extends createZodDto(getPaymentQuerySchema) { }

export const paginatedGetPaymentResponseSchema = z.object({
  count: z.number(),
  data: z.array(paymentSchema),
});
export class PaginatedGetPaymentResponseDto extends createZodDto(paginatedGetPaymentResponseSchema) { }

