import { createInsertSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { customer_orders, customer_orders_items } from 'src/database/schema';
import z from 'zod';

// price will be handle server side, so we don't need to validate it from client
const createItem = createInsertSchema(customer_orders_items, {
  variantId: z.string().uuid().describe('Mã biến thể sản phẩm'),
  quantity: z.number().min(1).describe('Số lượng'),
}).omit({ createdAt: true, updatedAt: true, orderId: true });
const createOrderSchema = createInsertSchema(customer_orders, {})
  .omit({
    userId: true, // userId sẽ được lấy từ context sau khi xác thực
    createdAt: true, // createdAt sẽ được set tự động bởi database
    updatedAt: true,
  })
  .extend({
    items: z.array(createItem).describe('Danh sách sản phẩm trong đơn hàng'),
    paymentMethodCode: z.string().describe('Mã phương thức thanh toán'),
  });

export class CreateOrderDto extends createZodDto(createOrderSchema) { }
