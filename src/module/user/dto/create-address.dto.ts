import { createInsertSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { user_addresses } from 'src/database/schema';

export const createAddressSchema = createInsertSchema(user_addresses, {
}).omit({
  id: true,
  userId: true,
});

export class CreateAddressDto extends createZodDto(createAddressSchema) {}
