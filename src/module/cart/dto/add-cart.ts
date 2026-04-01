import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AddCartSchema = z.object({
  variantId: z.string().uuid().describe('Mã biến thể sản phẩm'),
  quantity: z
    .number()
    .int()
    .min(1, 'Số lượng phải lớn hơn 0')
    .describe('Số lượng sản phẩm'),
  mode: z
    .enum(['increment', 'replace'])
    .default('increment')
    .describe('Chế độ cập nhật: cộng dồn (increment) hoặc thay thế (replace)'),
});

export class AddCartDto extends createZodDto(AddCartSchema) {}
