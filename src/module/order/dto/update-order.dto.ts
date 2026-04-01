import { createUpdateSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { customer_orders } from 'src/database/schema';
import { z } from 'zod';

// omit all execpt status and note (for log)
const updateOrder = createUpdateSchema(customer_orders, {})
  .pick({
    status: true,
  })
  .extend({
    note: z.string().optional(),
  });
export class UpdateOrderDto extends createZodDto(updateOrder) {}
