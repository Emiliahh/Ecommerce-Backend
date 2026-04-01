import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { users } from 'src/database/schema';
import z from 'zod';

const userSchema = createSelectSchema(users, {}).omit({
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
  provider: true,
  providerId: true,
  emailVerified: true,
});

export default class UserDTO extends createZodDto(userSchema) {}
