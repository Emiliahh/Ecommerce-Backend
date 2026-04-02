import { createInsertSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { order_logs } from 'src/database/schema';

const createOrderLogs = createInsertSchema(order_logs, {}).omit({
    createdAt: true
});
export class CreateOrderLogDto extends createZodDto(createOrderLogs) { }
