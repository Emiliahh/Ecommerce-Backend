import { createInsertSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { users } from 'src/database/schema';
import { z } from 'zod';

export const createUserSchema = createInsertSchema(users, {
  email: z.string().email().describe('Email của người dùng'),
  phone: z.string().min(10).max(15).describe('Số điện thoại'),
  passwordHash: z.string().min(6).describe('Mật khẩu'),
})
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    isDeleted: true,
    emailVerified: true,
  })
  .extend({
    password: z.string().min(6).describe('Mật khẩu của người dùng'),
  })
  .omit({ passwordHash: true });

export class CreateUserDto extends createZodDto(createUserSchema) { }
