import { createInsertSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { users } from 'src/database/schema';
import { z } from 'zod';

export const updateProfileSchema = createInsertSchema(users, {
  name: z.string().optional().describe('Họ và tên'),
  phone: z.string().min(10).max(15).optional().describe('Số điện thoại'),
  image: z.string().url().optional().describe('URL ảnh đại diện'),
}).pick({
  name: true,
  phone: true,
  image: true,
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
